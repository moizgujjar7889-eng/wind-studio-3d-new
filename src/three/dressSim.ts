import * as THREE from 'three';
import type { CharacterRig } from './character';
import { createSkirt, createHairStrands } from './cloth';

const WIND_DIR = new THREE.Vector3(-1, 0.05, 0.2).normalize();
const tmpV = new THREE.Vector3();

export interface DressSimulation {
  update(dt: number, time: number, wind01: number): void;
  dispose(): void;
}

/**
 * Full cloth setup: skirt tube + hair strands + hands rising to hold the hem.
 */
export function createDressSimulation(
  rig: CharacterRig,
  scene: THREE.Scene,
  opts: {
    dressColor: string;
    accentColor: string;
    hairColor: string;
    dressLength: number;
    fit: number;
    style?: string;
  },
): DressSimulation {
  const cols = 20;
  const rows = opts.style === 'trousers_top' ? 7 : 10;
  const waistWorldY = 1.02;
  const lengthMul = opts.style === 'trousers_top' ? 0.55 : opts.dressLength;
  const hemY = waistWorldY - 0.98 * lengthMul;
  const baseHemScale =
    opts.style === 'trousers_top' ? 1.2 : opts.fit < 0.5 ? 2.25 : 1.55;

  const { cloth: skirt, geometry: skirtGeo } = createSkirt({
    cols,
    rows,
    waistY: waistWorldY,
    hemY,
    waistRx: 0.125,
    waistRz: 0.125,
    hemScale: baseHemScale,
  });

  const dressMat = new THREE.MeshStandardMaterial({
    color: opts.dressColor,
    roughness: 0.82,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const skirtMesh = new THREE.Mesh(skirtGeo, dressMat);
  skirtMesh.frustumCulled = false;
  skirtMesh.castShadow = true;
  scene.add(skirtMesh);

  // Hair strands – match the number of hairRoots on the character
  const rootCount = Math.max(12, rig.hairRoots.length);
  const roots: THREE.Vector3[] = [];
  for (let i = 0; i < rootCount; i++) {
    const row = i % Math.ceil(rootCount / 2);
    const a = (row / Math.ceil(rootCount / 2)) * Math.PI * 2 + 0.18;
    const lvl = Math.floor(i / Math.ceil(rootCount / 2));
    const r = 0.07 - lvl * 0.014;
    roots.push(
      new THREE.Vector3(
        Math.sin(a) * r,
        lvl === 0 ? 0.06 : 0.012,
        Math.cos(a) * r * 0.85 - 0.02,
      ),
    );
  }

  const hair = createHairStrands({
    roots,
    segLen: 0.075,
    links: 11,
    dir: new THREE.Vector3(0, -0.02, 0.05),
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: opts.hairColor,
    roughness: 0.32,
    metalness: 0.07,
    side: THREE.DoubleSide,
  });
  const hairMesh = new THREE.Mesh(hair.geometry, hairMat);
  hairMesh.frustumCulled = false;
  scene.add(hairMesh);

  const gravity = -7.2;
  let hold = 0;
  const baseArmRotR = rig.armR.rotation.z;
  const baseArmRotL = rig.armL.rotation.z;

  function windForceAt(
    i: number,
    out: THREE.Vector3,
    t: number,
    wind01: number,
  ) {
    const p = skirt.pos;
    const y = p[i * 3 + 1];
    const height01 = THREE.MathUtils.clamp(
      (y - hemY) / Math.max(0.01, waistWorldY - hemY),
      0,
      1,
    );
    // Lower hem catches more wind
    const catchFactor = 0.2 + 0.8 * (1 - height01);
    const flutter =
      0.55 +
      0.45 * Math.sin(t * 6.2 + i * 0.55) * Math.sin(t * 3.1 + i * 0.28);
    // Stronger response so blowing feels satisfying
    const strength =
      (wind01 * wind01 * 6.5 + wind01 * 2.4) * catchFactor;
    out.copy(WIND_DIR).multiplyScalar(strength * flutter);
    // Upward lift on stronger gusts
    out.y += wind01 * wind01 * 1.6 * flutter * catchFactor;
    // Gentle idle sway
    if (wind01 < 0.1) {
      out.x += Math.sin(t * 1.15 + i * 0.4) * 0.045;
      out.z += Math.cos(t * 0.95 + i * 0.33) * 0.045;
    }
    return out;
  }

  function update(dt: number, time: number, wind01: number) {
    // Pin skirt waist to character waist anchors
    const anchorCount = rig.waistAnchors.length;
    for (let c = 0; c < cols; c++) {
      const anchor = rig.waistAnchors[c % anchorCount];
      anchor.getWorldPosition(tmpV);
      const p = c * 3;
      skirt.pos[p] = tmpV.x;
      skirt.pos[p + 1] = tmpV.y;
      skirt.pos[p + 2] = tmpV.z;
      skirt.prev[p] = tmpV.x;
      skirt.prev[p + 1] = tmpV.y;
      skirt.prev[p + 2] = tmpV.z;
    }

    skirt.step(dt, gravity, (i, out) => windForceAt(i, out, time, wind01));
    skirt.satisfy(6);

    // Keep cloth outside leg cylinder
    const minR = 0.155 + opts.fit * 0.025;
    for (let i = 0; i < skirt.count; i++) {
      if (skirt.pinned[i]) continue;
      const p = i * 3;
      if (skirt.pos[p + 1] > waistWorldY - 0.12) continue;
      const r = Math.sqrt(
        skirt.pos[p] * skirt.pos[p] + skirt.pos[p + 2] * skirt.pos[p + 2],
      );
      if (r < minR && r > 1e-5) {
        const s = minR / r;
        skirt.pos[p] *= s;
        skirt.pos[p + 2] *= s;
      }
      // Floor clamp
      if (skirt.pos[p + 1] < 0.02) skirt.pos[p + 1] = 0.02;
    }

    // Upload skirt geometry
    const posAttr = skirtGeo.getAttribute('position') as THREE.BufferAttribute;
    (posAttr.array as Float32Array).set(skirt.pos);
    posAttr.needsUpdate = true;
    skirtGeo.computeVertexNormals();

    // ---- Hair ----
    let v = 0;
    const hairPos = hair.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    const arr = hairPos.array as Float32Array;

    for (const strand of hair.strands) {
      const rootObj = rig.hairRoots[v % rig.hairRoots.length];
      if (rootObj) {
        rootObj.getWorldPosition(tmpV);
        strand.sim.setPos(0, tmpV.x, tmpV.y, tmpV.z);
      }

      strand.sim.step(dt, gravity * 0.85, (_i, out) => {
        const sway = 0.5 + 0.5 * Math.sin(time * 5.5 + v);
        out
          .copy(WIND_DIR)
          .multiplyScalar(
            (wind01 * wind01 * 8.5 + wind01 * 1.8) * (0.65 + 0.7 * sway),
          );
        out.y += Math.sin(time * 4.2 + v) * wind01 * 1.4;
        out.z += Math.cos(time * 3.1 + v * 1.6) * wind01 * 0.9;
      });
      strand.sim.satisfy(3);

      // Ribbon geometry
      for (let s = 0; s < strand.links - 1; s++) {
        const a = s * 3;
        const b = (s + 1) * 3;
        const ax = strand.sim.pos[a];
        const ay = strand.sim.pos[a + 1];
        const az = strand.sim.pos[a + 2];
        const bx = strand.sim.pos[b];
        const by = strand.sim.pos[b + 1];
        const bz = strand.sim.pos[b + 2];
        let sx = -(bz - az);
        let sz = bx - ax;
        const sl = Math.sqrt(sx * sx + sz * sz) || 1;
        sx /= sl;
        sz /= sl;
        const wA = 0.018 * (1 - (s / strand.links) * 0.55);
        const wB = 0.018 * (1 - ((s + 1) / strand.links) * 0.55);
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

    // ---- Hands rise to hold the hem when wind is strong ----
    // Starts reacting earlier and more strongly
    const target = THREE.MathUtils.clamp((wind01 - 0.22) / 0.5, 0, 1);
    hold += (target - hold) * Math.min(1, dt * 3.8);
    const lift = hold;

    // Arms lift outward and slightly forward
    rig.armR.rotation.z = baseArmRotR - lift * 0.72;
    rig.armL.rotation.z = baseArmRotL + lift * 0.72;
    // Bring arms a bit forward (toward the skirt)
    rig.armR.rotation.x = -lift * 0.35;
    rig.armL.rotation.x = -lift * 0.35;

    // Slight torso lean into the wind + head turn
    rig.torso.rotation.x = wind01 * 0.12;
    rig.torso.rotation.z = Math.sin(time * 1.3) * wind01 * 0.03;
    rig.head.rotation.y = -0.22 - wind01 * 0.28;
    rig.head.rotation.x = -wind01 * 0.08;
  }

  function dispose() {
    scene.remove(skirtMesh);
    scene.remove(hairMesh);
    skirtGeo.dispose();
    hair.geometry.dispose();
    dressMat.dispose();
    hairMat.dispose();
  }

  return { update, dispose };
}
