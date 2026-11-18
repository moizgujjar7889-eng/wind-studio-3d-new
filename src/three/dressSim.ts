import * as THREE from 'three';
import type { CharacterRig } from './character';
import { createSkirt, createHairStrands } from './cloth';

const WIND_DIR = new THREE.Vector3(-1, 0, 0.25).normalize();
const tmpV = new THREE.Vector3();

export interface DressSimulation {
  update(dt: number, time: number, wind01: number): void;
  dispose(): void;
}

/**
 * Full cloth setup for one character: skirt tube + hair strands + hands
 * raising to hold the hem as wind grows.
 */
export function createDressSimulation(
  rig: CharacterRig,
  scene: THREE.Scene,
  opts: { dressColor: string; accentColor: string; hairColor: string; dressLength: number; fit: number },
): DressSimulation {
  const cols = 18;
  const rows = 9;
  const waistWorldY = 1.0;
  const hemY = waistWorldY - (0.95 * opts.dressLength);
  const { cloth: skirt, geometry: skirtGeo } = createSkirt({
    cols,
    rows,
    waistY: waistWorldY,
    hemY,
    waistRx: 0.13,
    waistRz: 0.13,
    hemScale: opts.fit < 0.5 ? 2.1 : 1.45,
  });

  const dressMat = new THREE.MeshStandardMaterial({
    color: opts.dressColor,
    roughness: 0.85,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const skirtMesh = new THREE.Mesh(skirtGeo, dressMat);
  skirtMesh.frustumCulled = false;
  scene.add(skirtMesh);

  // hair
  const roots: THREE.Vector3[] = [];
  const hairWorldRoots: THREE.Vector3[] = [];
  for (let i = 0; i < 14; i++) {
    const row = i % 7;
    const a = (row / 7) * Math.PI * 2;
    const lvl = Math.floor(i / 7);
    roots.push(
      new THREE.Vector3(
        Math.sin(a) * (0.075 - lvl * 0.012),
        lvl === 0 ? 0.05 : 0,
        Math.cos(a) * 0.06 - 0.02,
      ),
    );
  }
  const hair = createHairStrands({
    roots: roots,
    segLen: 0.075,
    links: 11,
    dir: new THREE.Vector3(0, 0, 0.05),
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: opts.hairColor,
    roughness: 0.35,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const hairMesh = new THREE.Mesh(hair.geometry, hairMat);
  hairMesh.frustumCulled = false;
  scene.add(hairMesh);
  void hairWorldRoots;

  const gravity = -6.5;
  const hemIdx: number[] = [];
  for (let c = 0; c < cols; c++) hemIdx.push((rows - 1) * cols + c);

  // hand-hold state machine: 0 = arms free, 1 = hands holding hem
  let hold = 0;
  const baseArmRotR = rig.armR.rotation.z;
  const baseArmRotL = rig.armL.rotation.z;

  function windForceAt(i: number, out: THREE.Vector3, t: number, wind01: number) {
    const p = skirt.pos;
    const y = p[i * 3 + 1];
    const height01 = THREE.MathUtils.clamp((y - hemY) / Math.max(0.01, waistWorldY - hemY), 0, 1);
    const flutter = 0.55 + 0.45 * Math.sin(t * 7 + i * 0.7) * Math.sin(t * 3.1 + i * 0.23);
    const strength = wind01 * wind01 * 9 + wind01 * 2.2;
    out.copy(WIND_DIR)
      .multiplyScalar(strength * flutter * (0.35 + 0.65 * (1 - height01) * 0.5 + 0.5));
    out.y += wind01 * 2.4 * flutter;
    // gentle idle sway
    out.x += Math.sin(t * 1.3 + i * 0.5) * 0.12;
    out.z += Math.cos(t * 1.1 + i * 0.4) * 0.12;
    return out;
  }

  function update(dt: number, time: number, wind01: number) {
    // ---- skirt ----
    // pin skirt waist ring to the current waist anchor world positions
    for (let c = 0; c < cols; c++) {
      const anchor = rig.waistAnchors[c % rig.waistAnchors.length];
      anchor.getWorldPosition(tmpV);
      const i = c;
      const p = i * 3;
      skirt.pos[p] = tmpV.x;
      skirt.pos[p + 1] = tmpV.y;
      skirt.pos[p + 2] = tmpV.z;
      skirt.prev[p] = tmpV.x;
      skirt.prev[p + 1] = tmpV.y;
      skirt.prev[p + 2] = tmpV.z;
    }

    skirt.step(dt, gravity, (i, out) => windForceAt(i, out, time, wind01));
    skirt.satisfy(3);

    // skirt collision: keep hem outside a cylinder around the legs
    const minR = 0.16 + opts.fit * 0.02;
    for (let i = 0; i < skirt.count; i++) {
      if (skirt.pinned[i]) continue;
      const p = i * 3;
      if (skirt.pos[p + 1] - waistWorldY > -0.1) continue; // near waist, skip
      const r = Math.sqrt(skirt.pos[p] * skirt.pos[p] + skirt.pos[p + 2] * skirt.pos[p + 2]);
      if (r < minR && r > 1e-5) {
        const s = minR / r;
        skirt.pos[p] *= s;
        skirt.pos[p + 2] *= s;
      }
    }

    // upload skirt geometry
    const posAttr = skirtGeo.getAttribute('position') as THREE.BufferAttribute;
    (posAttr.array as Float32Array).set(skirt.pos);
    posAttr.needsUpdate = true;
    skirtGeo.computeVertexNormals();

    // ---- hair ----
    let v = 0;
    const hairPos = hair.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = hairPos.array as Float32Array;
    for (const strand of hair.strands) {
      const rootObj = rig.hairRoots[v];
      if (rootObj) {
        rootObj.getWorldPosition(tmpV);
        strand.sim.setPos(0, tmpV.x, tmpV.y, tmpV.z);
      }
      strand.sim.step(dt, gravity, (_i, out) => {
        const sway = 0.5 + 0.5 * Math.sin(time * 6 + v);
        out.copy(WIND_DIR)
          .multiplyScalar((wind01 * wind01 * 7 + wind01 * 1.5) * (0.7 + 0.6 * sway));
        out.y += Math.sin(time * 4 + v) * wind01 * 1.2;
        out.z += Math.cos(time * 3 + v * 1.7) * wind01 * 0.8;
      });
      strand.sim.satisfy(2);

      // upload as ribbon: for each segment, two verts offset in view-ish plane
      for (let s = 0; s < strand.links - 1; s++) {
        const a = s * 3;
        const b = (s + 1) * 3;
        const ax = strand.sim.pos[a];
        const ay = strand.sim.pos[a + 1];
        const az = strand.sim.pos[a + 2];
        const bx = strand.sim.pos[b];
        const by = strand.sim.pos[b + 1];
        const bz = strand.sim.pos[b + 2];
        // side vector = cross(dir, camRight approx (1,0,0)) fallback
        const dx = bx - ax;
        const dy = by - ay;
        const dz = bz - az;
        let sx = -dz;
        const sy = 0;
        let sz = dx;
        const sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
        sx /= sl;
        sz /= sl;
        const wA = 0.02 * (1 - (s / strand.links) * 0.6);
        const wB = 0.02 * (1 - ((s + 1) / strand.links) * 0.6);
        const base = v * strand.links * 2 + s * 2;
        arr[base * 3] = ax - sx * wA;
        arr[base * 3 + 1] = ay;
        arr[base * 3 + 2] = az - sz * wA;
        arr[(base + 1) * 3] = ax + sx * wA;
        arr[(base + 1) * 3 + 1] = ay;
        arr[(base + 1) * 3 + 2] = az + sz * wA;
        arr[(base + 2) * 3] = bx - sx * wB;
        arr[(base + 2) * 3 + 1] = by;
        arr[(base + 2) * 3 + 2] = bz - sz * wB;
        arr[(base + 3) * 3] = bx + sx * wB;
        arr[(base + 3) * 3 + 1] = by;
        arr[(base + 3) * 3 + 2] = bz + sz * wB;
      }
      v++;
    }
    hairPos.needsUpdate = true;

    // ---- hands rise to hold hem under strong wind ----
    const target = THREE.MathUtils.clamp((wind01 - 0.35) / 0.45, 0, 1);
    hold += (target - hold) * Math.min(1, dt * 4);
    const lift = hold;
    rig.armR.rotation.z = baseArmRotR - lift * 0.55;
    rig.armL.rotation.z = baseArmRotL + lift * 0.55;
    // slight forward hunch with strong wind
    rig.torso.rotation.x = wind01 * 0.1;
    // head turns slightly away from the wind
    rig.head.rotation.y = -0.25 - wind01 * 0.2;
  }

  function dispose() {
    scene.remove(skirtMesh, hairMesh);
    skirtGeo.dispose();
    hair.geometry.dispose();
    dressMat.dispose();
    hairMat.dispose();
  }

  return { update, dispose };
}
