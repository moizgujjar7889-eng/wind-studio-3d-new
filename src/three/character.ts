import * as THREE from 'three';
import type { CharacterPreset } from '../lib/types';

export interface CharacterRig {
  group: THREE.Group;
  waistAnchors: THREE.Object3D[];
  sleeveAnchors: THREE.Object3D[];
  handR: THREE.Object3D;
  handL: THREE.Object3D;
  head: THREE.Object3D;
  torso: THREE.Object3D;
  armR: THREE.Object3D;
  armL: THREE.Object3D;
  hairRoots: THREE.Object3D[];
}

function mat(color: string, rough = 0.6) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: 0.02,
  });
}

function smooth(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (mesh.geometry) {
    mesh.geometry.computeVertexNormals();
  }
  return mesh;
}

/**
 * High-detail procedural adult character.
 * This remains asset-free so the app can run on mobile without a large GLB.
 * It is intentionally more anatomically proportioned and softly shaded than
 * the original blocky placeholder.
 */
export function buildCharacter(preset: CharacterPreset): CharacterRig {
  const group = new THREE.Group();
  const skin = mat(preset.skinTone, 0.48);
  const hairMat = new THREE.MeshStandardMaterial({
    color: preset.hairColor,
    roughness: 0.28,
    metalness: 0.02,
  });

  const hipY = 0.88;
  const shoulderY = 1.40;
  const neckY = 1.48;
  const headY = 1.64;

  const torso = new THREE.Group();
  torso.position.y = hipY;
  group.add(torso);

  const dressMat = new THREE.MeshStandardMaterial({
    color: preset.dressColor,
    roughness: 0.62,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: preset.accentColor,
    roughness: 0.35,
    metalness: 0.12,
  });

  // Soft anatomical torso volumes, hidden under the dress bodice.
  const chest = smooth(new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 32, 20),
    dressMat,
  ));
  chest.scale.set(0.88, 0.92, 0.56);
  chest.position.set(0, 0.36, 0.0);
  torso.add(chest);

  const waist = smooth(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.18, 8, 20),
    dressMat,
  ));
  waist.scale.set(1.0, 0.92, 0.78);
  waist.position.y = 0.12;
  torso.add(waist);

  const belt = smooth(new THREE.Mesh(
    new THREE.TorusGeometry(0.132, 0.012, 10, 32),
    accentMat,
  ));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.10;
  torso.add(belt);

  // Neck.
  const neck = smooth(new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.055, 0.11, 20),
    skin,
  ));
  neck.position.y = neckY - hipY + 0.03;
  torso.add(neck);

  // Head with separate face volumes for softer silhouette.
  const head = new THREE.Group();
  head.position.y = headY - hipY;
  torso.add(head);

  const face = smooth(new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 32, 24),
    skin,
  ));
  face.scale.set(0.86, 1.08, 0.91);
  face.position.set(0, 0.0, 0.005);
  head.add(face);

  const chin = smooth(new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 24, 18),
    skin,
  ));
  chin.scale.set(0.88, 0.62, 0.72);
  chin.position.set(0, -0.075, 0.045);
  head.add(chin);

  // Hair cap and a few broad locks instead of the old spiky strands.
  const cap = smooth(new THREE.Mesh(
    new THREE.SphereGeometry(0.119, 32, 24),
    hairMat,
  ));
  cap.scale.set(0.94, 1.05, 0.98);
  cap.position.set(0, 0.018, -0.008);
  head.add(cap);

  const lockGeo = new THREE.CapsuleGeometry(0.022, 0.19, 6, 12);
  const leftLock = smooth(new THREE.Mesh(lockGeo, hairMat));
  leftLock.position.set(-0.092, -0.06, 0.005);
  leftLock.rotation.z = -0.10;
  head.add(leftLock);
  const rightLock = smooth(new THREE.Mesh(lockGeo, hairMat));
  rightLock.position.set(0.092, -0.06, 0.005);
  rightLock.rotation.z = 0.10;
  head.add(rightLock);

  // Eyes, brows, nose and lips give the face readable adult features.
  const eyeMat = new THREE.MeshStandardMaterial({
    color: '#15120f',
    roughness: 0.22,
    metalness: 0.0,
  });
  const eyeGeo = new THREE.SphereGeometry(0.012, 16, 12);
  for (const side of [-1, 1]) {
    const eye = smooth(new THREE.Mesh(eyeGeo, eyeMat));
    eye.position.set(side * 0.036, 0.018, 0.103);
    eye.scale.set(1.0, 0.82, 0.55);
    head.add(eye);

    const brow = smooth(new THREE.Mesh(
      new THREE.CapsuleGeometry(0.006, 0.026, 4, 8),
      hairMat,
    ));
    brow.position.set(side * 0.036, 0.045, 0.098);
    brow.rotation.z = side * 0.08;
    head.add(brow);
  }

  const nose = smooth(new THREE.Mesh(
    new THREE.ConeGeometry(0.014, 0.045, 12),
    skin,
  ));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.005, 0.108);
  head.add(nose);

  const lipMat = new THREE.MeshStandardMaterial({
    color: '#9f4b50',
    roughness: 0.42,
  });
  const lips = smooth(new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 16, 10),
    lipMat,
  ));
  lips.scale.set(1.25, 0.38, 0.55);
  lips.position.set(0, -0.052, 0.105);
  head.add(lips);

  // Arms with visible forearms and hands.
  function buildArm(side: -1 | 1) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.18, shoulderY - hipY + 0.02, 0);

    const upper = smooth(new THREE.Mesh(
      new THREE.CapsuleGeometry(0.041, 0.22, 8, 16),
      skin,
    ));
    upper.position.y = -0.13;
    arm.add(upper);

    const sleeve = smooth(new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.064, 0.17, 20),
      dressMat,
    ));
    sleeve.position.y = -0.08;
    arm.add(sleeve);

    const fore = new THREE.Group();
    fore.position.y = -0.25;

    const foreMesh = smooth(new THREE.Mesh(
      new THREE.CapsuleGeometry(0.034, 0.22, 8, 16),
      skin,
    ));
    foreMesh.position.y = -0.13;
    fore.add(foreMesh);

    const hand = smooth(new THREE.Mesh(
      new THREE.SphereGeometry(0.043, 18, 14),
      skin,
    ));
    hand.scale.set(0.82, 1.12, 0.68);
    hand.position.y = -0.275;
    fore.add(hand);

    arm.add(fore);
    arm.rotation.z = side * 0.08;
    return { arm, fore, hand };
  }

  const armR = buildArm(1);
  const armL = buildArm(-1);
  torso.add(armR.arm, armL.arm);

  // Legs and simple shoes.
  const legGeo = new THREE.CapsuleGeometry(0.052, 0.72, 8, 16);
  const legL = smooth(new THREE.Mesh(legGeo, skin));
  legL.position.set(-0.075, 0.42, 0);
  const legR = smooth(new THREE.Mesh(legGeo, skin));
  legR.position.set(0.075, 0.42, 0);
  group.add(legL, legR);

  const shoeMat = mat('#29231f', 0.42);
  const shoeGeo = new THREE.BoxGeometry(0.095, 0.055, 0.19);
  const shoeL = smooth(new THREE.Mesh(shoeGeo, shoeMat));
  shoeL.position.set(-0.075, 0.025, 0.025);
  const shoeR = smooth(new THREE.Mesh(shoeGeo, shoeMat));
  shoeR.position.set(0.075, 0.025, 0.025);
  group.add(shoeL, shoeR);

  // Cloth anchors.
  const waistAnchors: THREE.Object3D[] = [];
  const WAIST_COLS = 18;
  for (let c = 0; c < WAIST_COLS; c++) {
    const o = new THREE.Object3D();
    const a = (c / WAIST_COLS) * Math.PI * 2;
    o.position.set(Math.sin(a) * 0.13, 0.10, Math.cos(a) * 0.13);
    torso.add(o);
    waistAnchors.push(o);
  }

  const sleeveAnchors: THREE.Object3D[] = [];
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 6; k++) {
      const o = new THREE.Object3D();
      const a = (k / 6) * Math.PI * 2;
      o.position.set(
        side * 0.18 + Math.sin(a) * 0.055,
        shoulderY - hipY - 0.14,
        Math.cos(a) * 0.055,
      );
      torso.add(o);
      sleeveAnchors.push(o);
    }
  }

  // Roots are kept stable and are used by the hair simulation.
  const hairRoots: THREE.Object3D[] = [];
  for (let i = 0; i < 14; i++) {
    const row = i % 7;
    const a = (row / 7) * Math.PI * 2;
    const lvl = Math.floor(i / 7);
    const o = new THREE.Object3D();
    o.position.set(
      Math.sin(a) * (0.078 - lvl * 0.010),
      lvl === 0 ? 0.045 : -0.005,
      Math.cos(a) * 0.065 - 0.018,
    );
    head.add(o);
    hairRoots.push(o);
  }

  return {
    group,
    waistAnchors,
    sleeveAnchors,
    handR: armR.hand,
    handL: armL.hand,
    head,
    torso,
    armR: armR.arm,
    armL: armL.arm,
    hairRoots,
  };
}
