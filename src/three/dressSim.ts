import * as THREE from 'three';
import type { CharacterRig } from './character';
import { createSkirt, createHairStrands } from './cloth';

const WIND_DIR = new THREE.Vector3(-1, 0, 0.12).normalize();
const tmpV = new THREE.Vector3();

export interface DressSimulation {
  update(dt: number, time: number, wind01: number): void;
  dispose(): void;
}

export function createDressSimulation(
  rig: CharacterRig,
  scene: THREE.Scene,
  opts: { dressColor: string; accentColor: string; hairColor: string; dressLength: number; fit: number },
): DressSimulation {
  const cols = 24;
  const rows = 12;
  const waistWorldY = 1.0;
  const hemY = waistWorldY - 0.86 * opts.dressLength;

  const { cloth: skirt, geometry: skirtGeo } = createSkirt({
    cols,
    rows,
    waistY: waistWorldY,
    hemY,
    waistRx: 0.14,
    waistRz: 0.14,
    hemScale: opts.fit < 0.5 ? 1.75 : 1.42,
  });

  const dressMat = new THREE.MeshStandardMaterial({
    color: opts.dressColor,
    roughness: 0.82,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const skirtMesh = new THREE.Mesh(skirtGeo, dressMat);
  skirtMesh.frustumCulled = false;
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  scene.add(skirtMesh);

  const roots: THREE.Vector3[] = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    roots.push(new THREE.Vector3(side * (0.04 + (row % 4) * 0.018), 0.055 - row * 0.012, -0.02 - (row % 3) * 0.018));
  }
  const hair = createHairStrands({ roots, segLen: 0.055, links: 13, dir: new THREE.Vector3(0, 0, 0.02) });
  const hairMat = new THREE.MeshStandardMaterial({
    color: opts.hairColor,
    roughness: 0.38,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const hairMesh = new THREE.Mesh(hair.geometry, hairMat);
  hairMesh.frustumCulled = false;
  hairMesh.castShadow = true;
  scene.add(hairMesh);

  const gravity = -5.8;
  const baseArmRotR = rig.armR.rotation.z;
  const baseArmRotL = rig.armL.rotation.z;
  let hold = 0;

  function windForceAt(i: number, out: THREE.Vector3, t: number, w: number) {
    // No wind force at rest. Wind response ramps in smoothly above ~10%.
    const active = THREE.MathUtils.smoothstep(w, 0.08, 1);
    const p = skirt.pos;
    const y = p[i * 3 + 1];
    const height01 = THREE.MathUtils.clamp((y - hemY) / Math.max(0.01, waistWorldY - hemY), 0, 1);
    const gust = 0.86 + 0.14 * Math.sin(t * 8 + i * 0.37);
    const strength = (active * active) * 2.4 * gust;

    out.copy(WIND_DIR).multiplyScalar(strength * (0.35 + 0.65 * (1 - height01)));

    // Lift only becomes noticeable in stronger gusts; this prevents the skirt
    // from floating upward before the user blows into the microphone.
    const lift = THREE.MathUtils.smoothstep(w, 0.48, 1);
    out.y += lift * 1.25 * (1 - height01) * gust;
    out.z += Math.sin(t * 4.5 + i * 0.21) * active * 0.16;
    return out;
  }

  function update(dt: number, time: number, wind01: number) {
    // Pin only the waist. Pinned particles are reset every frame to eliminate drift.
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

    // Two small substeps keep the cloth stable on mobile browsers.
    const sub = Math.min(2, Math.max(1, Math.ceil(dt / 0.018)));
    for (let s = 0; s < sub; s++) {
      skirt.step(dt / sub, gravity, (i, out) => windForceAt(i, out, time, wind01));
      skirt.satisfy(5);
    }

    // Keep the cloth outside the legs and below the waist.
    const minR = 0.155;
    for (let i = 0; i < skirt.count; i++) {
      if (skirt.pinned[i]) continue;
      const p = i * 3;
      const localY = skirt.pos[p + 1] - waistWorldY;
      if (localY > -0.06) continue;
      const r = Math.hypot(skirt.pos[p], skirt.pos[p + 2]);
      if (r < minR && r > 1e-5) {
        const s = minR / r;
        skirt.pos[p] *= s;
        skirt.pos[p + 2] *= s;
      }
    }

    const posAttr = skirtGeo.getAttribute('position') as THREE.BufferAttribute;
    (posAttr.array as Float32Array).set(skirt.pos);
    posAttr.needsUpdate = true;
    skirtGeo.computeVertexNormals();

    // Hair reacts more softly than cloth.
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
        const active = THREE.MathUtils.smoothstep(wind01, 0.08, 1);
        out.copy(WIND_DIR).multiplyScalar(active * active * 1.7);
        out.y += Math.sin(time * 3 + v) * active * 0.18;
      });
      strand.sim.satisfy(4);

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
        const wA = 0.014 * (1 - (s / strand.links) * 0.55);
        const wB = 0.014 * (1 - ((s + 1) / strand.links) * 0.55);
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

    // Hands move toward the lower front of the dress only during stronger wind.
    const target = THREE.MathUtils.smoothstep(wind01, 0.38, 0.72);
    hold += (target - hold) * Math.min(1, dt * 5);
    rig.armR.rotation.z = baseArmRotR - hold * 0.58;
    rig.armL.rotation.z = baseArmRotL + hold * 0.58;
    rig.torso.rotation.x = -hold * 0.035;
    rig.head.rotation.y = -hold * 0.08;
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
