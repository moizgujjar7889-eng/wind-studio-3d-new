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
 * Stable cloth simulation:
 * - completely still when wind is off
 * - horizontal wind is dominant
 * - lift is introduced gradually only at stronger gusts
 * - constrained movement prevents the skirt from exploding upward
 */
export function createDressSimulation(
  rig: CharacterRig,
  scene: THREE.Scene,
  opts: { dressColor: string; accentColor: string; hairColor: string; dressLength: number; fit: number },
): DressSimulation {
  const cols = 20;
  const rows = 11;
  const waistWorldY = 1.0;
  const hemY = waistWorldY - (0.92 * opts.dressLength);

  const { cloth: skirt, geometry: skirtGeo } = createSkirt({
    cols,
    rows,
    waistY: waistWorldY,
    hemY,
    waistRx: 0.17,
    waistRz: 0.17,
    hemScale: opts.fit < 0.5 ? 1.75 : 1.35,
  });

  const dressMat = new THREE.MeshStandardMaterial({
    color: opts.dressColor,
    roughness: 0.82,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const skirtMesh = new THREE.Mesh(skirtGeo, dressMat);
  skirtMesh.frustumCulled = false;
  scene.add(skirtMesh);

  // Add a clean, non-simulated underskirt so the outfit still looks dressed
  // even before the cloth reacts.
  const underMat = new THREE.MeshStandardMaterial({
    color: opts.dressColor,
    roughness: 0.88,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  const underGeo = new THREE.CylinderGeometry(
    0.155,
    0.27 * (opts.fit < 0.5 ? 1.55 : 1.25),
    Math.max(0.25, 0.92 * opts.dressLength),
    32,
    8,
    true,
  );
  const under = new THREE.Mesh(underGeo, underMat);
  under.position.y = waistWorldY - (0.46 * opts.dressLength);
  scene.add(under);

  // Hair strands
  const roots: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    roots.push(new THREE.Vector3(
      Math.sin(a) * 0.09,
      0.02 + Math.cos(a) * 0.035,
      Math.cos(a) * 0.055 - 0.015,
    ));
  }

  const hair = createHairStrands({
    roots,
    segLen: 0.065,
    links: 12,
    dir: new THREE.Vector3(0, 0, 0.025),
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: opts.hairColor,
    roughness: 0.30,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  const hairMesh = new THREE.Mesh(hair.geometry, hairMat);
  hairMesh.frustumCulled = false;
  scene.add(hairMesh);

  let hold = 0;
  const baseArmRotR = rig.armR.rotation.z;
  const baseArmRotL = rig.armL.rotation.z;

  function windForceAt(i: number, out: THREE.Vector3, time: number, wind01: number) {
    // No wind = no force. This is important: the dress must not float at idle.
    if (wind01 < 0.035) {
      out.set(0, 0, 0);
      return;
    }

    const p = skirt.pos;
    const y = p[i * 3 + 1];
    const height01 = THREE.MathUtils.clamp(
      (y - hemY) / Math.max(0.01, waistWorldY - hemY),
      0,
      1,
    );

    const gust = 0.72 + 0.28 * Math.sin(time * 8.0 + i * 0.31);
    const edge = 0.35 + 0.65 * (1 - height01);

    // Horizontal wind drives the cloth; vertical lift only becomes noticeable
    // at stronger gusts and is deliberately capped.
    const horizontal = THREE.MathUtils.clamp(
      (wind01 * wind01 * 5.0 + wind01 * 0.7) * gust * edge,
      0,
      4.0,
    );

    const lift01 = THREE.MathUtils.clamp((wind01 - 0.48) / 0.52, 0, 1);
    const lift = lift01 * lift01 * 1.45 * (1 - height01 * 0.65);

    out.copy(WIND_DIR).multiplyScalar(horizontal);
    out.y = lift;

    // Tiny natural cloth noise only while wind is actually present.
    out.x += Math.sin(time * 5.5 + i * 0.37) * wind01 * 0.05;
    out.z += Math.cos(time * 4.7 + i * 0.22) * wind01 * 0.05;
  }

  function update(dt: number, time: number, wind01: number) {
    // Re-pin the waist exactly to the body.
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

    skirt.step(dt, -5.8, (i, out) => windForceAt(i, out, time, wind01));
    skirt.satisfy(5);

    // Soft body/leg collision. Never allow the cloth to collapse through the legs.
    const minR = 0.16;
    for (let i = 0; i < skirt.count; i++) {
      if (skirt.pinned[i]) continue;
      const p = i * 3;
      const r = Math.sqrt(skirt.pos[p] ** 2 + skirt.pos[p + 2] ** 2);
      if (skirt.pos[p + 1] < waistWorldY - 0.08 && r < minR) {
        const s = minR / Math.max(r, 1e-5);
        skirt.pos[p] *= s;
        skirt.pos[p + 2] *= s;
      }
      // Absolute vertical safety bound.
      const maxLift = waistWorldY + 0.18 + wind01 * 0.22;
      if (skirt.pos[p + 1] > maxLift) skirt.pos[p + 1] = maxLift;
    }

    const posAttr = skirtGeo.getAttribute('position') as THREE.BufferAttribute;
    (posAttr.array as Float32Array).set(skirt.pos);
    posAttr.needsUpdate = true;
    skirtGeo.computeVertexNormals();

    // Hair follows the same wind, but with much smaller forces.
    const hairPos = hair.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = hairPos.array as Float32Array;

    for (let v = 0; v < hair.strands.length; v++) {
      const strand = hair.strands[v];
      const rootObj = rig.hairRoots[v];
      if (rootObj) {
        rootObj.getWorldPosition(tmpV);
        strand.sim.setPos(0, tmpV.x, tmpV.y, tmpV.z);
      }

      strand.sim.step(dt, -4.8, (_i, out) => {
        if (wind01 < 0.035) {
          out.set(0, 0, 0);
          return;
        }
        out.copy(WIND_DIR).multiplyScalar(wind01 * wind01 * 2.5);
        out.y += wind01 * 0.35;
      });
      strand.sim.satisfy(3);

      for (let s = 0; s < strand.links - 1; s++) {
        const a = s * 3;
        const b = (s + 1) * 3;
        const ax = strand.sim.pos[a], ay = strand.sim.pos[a + 1], az = strand.sim.pos[a + 2];
        const bx = strand.sim.pos[b], by = strand.sim.pos[b + 1], bz = strand.sim.pos[b + 2];

        let sx = -(bz - az);
        let sz = bx - ax;
        const sl = Math.hypot(sx, sz) || 1;
        sx /= sl;
        sz /= sl;

        const wA = 0.024 * (1 - (s / strand.links) * 0.65);
        const wB = 0.024 * (1 - ((s + 1) / strand.links) * 0.65);
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
    }
    hairPos.needsUpdate = true;

    // At stronger wind the character raises her arms toward the skirt.
    const target = THREE.MathUtils.clamp((wind01 - 0.48) / 0.38, 0, 1);
    hold += (target - hold) * Math.min(1, dt * 5);
    rig.armR.rotation.z = baseArmRotR - hold * 0.72;
    rig.armL.rotation.z = baseArmRotL + hold * 0.72;
    rig.torso.rotation.x = hold * 0.055;
    rig.head.rotation.y = -hold * 0.08;
  }

  function dispose() {
    scene.remove(skirtMesh, under, hairMesh);
    skirtGeo.dispose();
    underGeo.dispose();
    hair.geometry.dispose();
    dressMat.dispose();
    underMat.dispose();
    hairMat.dispose();
  }

  return { update, dispose };
}
