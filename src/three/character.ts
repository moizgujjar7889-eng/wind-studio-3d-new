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

function mat(color: string, roughness = 0.6, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function roundedPart(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildCharacter(preset: CharacterPreset): CharacterRig {
  const group = new THREE.Group();
  const skin = mat(preset.skinTone, 0.5);
  const hairMat = mat(preset.hairColor, 0.34, 0.03);
  const dressMat = new THREE.MeshStandardMaterial({
    color: preset.dressColor,
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const accentMat = mat(preset.accentColor, 0.38, 0.12);

  // Adult-sized proportions; feet are near y=0.
  const hipY = 0.94;
  const shoulderY = 1.47;
  const headY = 1.72;

  const torso = new THREE.Group();
  torso.position.y = hipY;
  group.add(torso);

  // Fitted upper garment.
  const chest = roundedPart(new THREE.CapsuleGeometry(0.17, 0.27, 8, 20), dressMat);
  chest.scale.set(1.18, 1.0, 0.72);
  chest.position.y = 0.31;
  torso.add(chest);

  const waist = roundedPart(new THREE.CylinderGeometry(0.125, 0.15, 0.22, 24), dressMat);
  waist.position.y = 0.12;
  torso.add(waist);

  const belt = roundedPart(new THREE.TorusGeometry(0.142, 0.012, 10, 32), accentMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.105;
  torso.add(belt);

  // Neck and head.
  const neck = roundedPart(new THREE.CylinderGeometry(0.045, 0.052, 0.11, 16), skin);
  neck.position.y = 0.67;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = headY - hipY;
  torso.add(head);

  const skull = roundedPart(new THREE.SphereGeometry(0.125, 32, 24), skin);
  skull.scale.set(0.86, 1.02, 0.84);
  skull.position.y = 0.02;
  head.add(skull);

  const jaw = roundedPart(new THREE.SphereGeometry(0.083, 24, 18), skin);
  jaw.scale.set(0.92, 0.72, 0.78);
  jaw.position.set(0, -0.07, 0.025);
  head.add(jaw);

  // Hair cap + back volume + side locks.
  const cap = roundedPart(new THREE.SphereGeometry(0.133, 32, 24), hairMat);
  cap.scale.set(0.9, 1.02, 0.9);
  cap.position.set(0, 0.035, -0.012);
  head.add(cap);

  const backHair = roundedPart(new THREE.CapsuleGeometry(0.105, 0.24, 8, 20), hairMat);
  backHair.scale.set(1.02, 1.0, 0.56);
  backHair.position.set(0, -0.11, -0.065);
  backHair.rotation.x = Math.PI / 2;
  head.add(backHair);

  const lockGeo = new THREE.CapsuleGeometry(0.018, 0.19, 5, 10);
  for (const side of [-1, 1]) {
    const lock = roundedPart(lockGeo, hairMat);
    lock.position.set(side * 0.085, -0.08, 0.02);
    lock.rotation.z = side * 0.06;
    head.add(lock);
  }

  // Face details.
  const eyeWhite = mat('#f4f2ed', 0.35);
  const irisMat = mat('#2d4b58', 0.28, 0.02);
  const pupilMat = mat('#111111', 0.25);
  const eyeGeo = new THREE.SphereGeometry(0.018, 16, 12);
  for (const side of [-1, 1]) {
    const eye = roundedPart(eyeGeo, eyeWhite);
    eye.scale.set(1.0, 0.82, 0.55);
    eye.position.set(side * 0.043, 0.025, 0.112);
    head.add(eye);

    const iris = roundedPart(new THREE.SphereGeometry(0.008, 12, 10), irisMat);
    iris.position.set(side * 0.043, 0.025, 0.122);
    head.add(iris);

    const pupil = roundedPart(new THREE.SphereGeometry(0.0038, 10, 8), pupilMat);
    pupil.position.set(side * 0.043, 0.025, 0.129);
    head.add(pupil);

    const brow = roundedPart(new THREE.BoxGeometry(0.035, 0.006, 0.005), hairMat);
    brow.position.set(side * 0.043, 0.058, 0.116);
    brow.rotation.z = side * -0.05;
    head.add(brow);
  }

  const nose = roundedPart(new THREE.ConeGeometry(0.009, 0.035, 10), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.006, 0.121);
  head.add(nose);

  const lipMat = mat('#9d4b55', 0.45);
  const upperLip = roundedPart(new THREE.SphereGeometry(0.015, 16, 10), lipMat);
  upperLip.scale.set(1.45, 0.42, 0.5);
  upperLip.position.set(0, -0.052, 0.118);
  head.add(upperLip);

  // Arms, sleeves and hands.
  function buildArm(side: -1 | 1) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.215, shoulderY - hipY, 0);

    const upper = roundedPart(new THREE.CapsuleGeometry(0.048, 0.20, 7, 14), skin);
    upper.position.y = -0.12;
    arm.add(upper);

    const sleeve = roundedPart(new THREE.CylinderGeometry(0.066, 0.058, 0.19, 20), dressMat);
    sleeve.position.y = -0.07;
    arm.add(sleeve);

    const fore = new THREE.Group();
    fore.position.y = -0.25;
    const foreMesh = roundedPart(new THREE.CapsuleGeometry(0.040, 0.20, 7, 14), skin);
    foreMesh.position.y = -0.12;
    fore.add(foreMesh);

    const hand = roundedPart(new THREE.SphereGeometry(0.043, 16, 12), skin);
    hand.scale.set(0.8, 1.15, 0.62);
    hand.position.y = -0.25;
    fore.add(hand);

    arm.add(fore);
    arm.rotation.z = side * 0.08;
    return { arm, fore, hand };
  }

  const armR = buildArm(1);
  const armL = buildArm(-1);
  torso.add(armR.arm, armL.arm);

  // Legs and shoes.
  const legGeo = new THREE.CapsuleGeometry(0.052, 0.72, 7, 14);
  const legL = roundedPart(legGeo, skin);
  legL.position.set(-0.075, 0.43, 0);
  const legR = roundedPart(legGeo, skin);
  legR.position.set(0.075, 0.43, 0);
  group.add(legL, legR);

  const shoeMat = mat('#241b1a', 0.42);
  const shoeGeo = new THREE.BoxGeometry(0.095, 0.055, 0.17);
  const shoeL = roundedPart(shoeGeo, shoeMat);
  shoeL.position.set(-0.075, 0.035, 0.025);
  const shoeR = roundedPart(shoeGeo, shoeMat);
  shoeR.position.set(0.075, 0.035, 0.025);
  group.add(shoeL, shoeR);

  // Waist anchors for the simulated skirt.
  const waistAnchors: THREE.Object3D[] = [];
  const WAIST_COLS = 20;
  for (let c = 0; c < WAIST_COLS; c++) {
    const o = new THREE.Object3D();
    const a = (c / WAIST_COLS) * Math.PI * 2;
    o.position.set(Math.sin(a) * 0.14, 0.055, Math.cos(a) * 0.14);
    torso.add(o);
    waistAnchors.push(o);
  }

  const sleeveAnchors: THREE.Object3D[] = [];
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 6; k++) {
      const o = new THREE.Object3D();
      const a = (k / 6) * Math.PI * 2;
      o.position.set(side * 0.215 + Math.sin(a) * 0.06, shoulderY - hipY - 0.09, Math.cos(a) * 0.055);
      torso.add(o);
      sleeveAnchors.push(o);
    }
  }

  // Hair strand roots.
  const hairRoots: THREE.Object3D[] = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const o = new THREE.Object3D();
    o.position.set(side * (0.04 + (row % 4) * 0.018), 0.055 - row * 0.012, -0.02 - (row % 3) * 0.018);
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
