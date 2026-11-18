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
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
}

function capsule(radius: number, length: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 16), material);
}

export function buildCharacter(preset: CharacterPreset): CharacterRig {
  const group = new THREE.Group();

  const skin = mat(preset.skinTone, 0.48);
  const skinSoft = mat(preset.skinTone, 0.58);
  const hairMat = new THREE.MeshStandardMaterial({
    color: preset.hairColor,
    roughness: 0.28,
    metalness: 0.02,
  });

  // Adult human proportions: feet to crown ~1.82m.
  const hipY = 0.98;
  const shoulderY = 1.47;
  const neckY = 1.57;
  const headY = 1.73;

  // Dressed torso / blouse.
  const torso = new THREE.Group();
  torso.position.y = hipY;
  group.add(torso);

  const dressMat = new THREE.MeshStandardMaterial({
    color: preset.dressColor,
    roughness: 0.78,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: preset.accentColor,
    roughness: 0.42,
    metalness: 0.12,
  });

  const chest = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.30, 8, 20),
    dressMat,
  );
  chest.scale.set(0.88, 1.0, 0.62);
  chest.position.y = 0.30;
  torso.add(chest);

  const waist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.19, 0.24, 24),
    dressMat,
  );
  waist.position.y = 0.05;
  torso.add(waist);

  // neckline + waist trim
  const neckline = new THREE.TorusGeometry(0.13, 0.012, 8, 28, Math.PI * 1.55);
  const neckTrim = new THREE.Mesh(neckline, accentMat);
  neckTrim.rotation.x = Math.PI / 2;
  neckTrim.rotation.z = Math.PI / 2;
  neckTrim.position.set(0, 0.48, 0.08);
  torso.add(neckTrim);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 10, 32), accentMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.02;
  torso.add(belt);

  // neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.12, 16), skin);
  neck.position.y = neckY - hipY;
  torso.add(neck);

  // head
  const head = new THREE.Group();
  head.position.y = headY - hipY;
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.128, 32, 24), skin);
  skull.scale.set(0.88, 1.05, 0.86);
  skull.position.z = 0.005;
  head.add(skull);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 18), skin);
  jaw.scale.set(0.78, 0.72, 0.72);
  jaw.position.set(0, -0.065, 0.045);
  head.add(jaw);

  // hair cap + long back/side panels
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.136, 32, 24), hairMat);
  cap.scale.set(0.91, 1.03, 0.9);
  cap.position.set(0, 0.025, -0.018);
  head.add(cap);

  const backHair = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.115, 0.36, 8, 16),
    hairMat,
  );
  backHair.scale.set(1.0, 1.15, 0.55);
  backHair.position.set(0, -0.16, -0.07);
  head.add(backHair);

  for (const side of [-1, 1]) {
    const lock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.038, 0.32, 6, 12),
      hairMat,
    );
    lock.position.set(side * 0.105, -0.15, 0.01);
    lock.rotation.z = side * 0.08;
    head.add(lock);
  }

  // face
  const eyeWhite = new THREE.MeshStandardMaterial({ color: '#f7f2ec', roughness: 0.4 });
  const eyeDark = new THREE.MeshStandardMaterial({ color: '#17120f', roughness: 0.3 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), eyeWhite);
    eye.scale.set(1.0, 0.72, 0.55);
    eye.position.set(side * 0.042, 0.012, 0.105);
    head.add(eye);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), eyeDark);
    iris.position.set(side * 0.042, 0.012, 0.114);
    head.add(iris);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 8), skinSoft);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.018, 0.112);
  head.add(nose);

  const lipMat = new THREE.MeshStandardMaterial({ color: '#9e4e50', roughness: 0.45 });
  const lips = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), lipMat);
  lips.scale.set(1.35, 0.42, 0.5);
  lips.position.set(0, -0.073, 0.108);
  head.add(lips);

  // arms
  function buildArm(side: -1 | 1) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.22, shoulderY - hipY + 0.02, 0);

    const upper = capsule(0.055, 0.19, skin);
    upper.position.y = -0.13;
    arm.add(upper);

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.068, 0.18, 18),
      dressMat,
    );
    sleeve.position.y = -0.09;
    arm.add(sleeve);

    const fore = new THREE.Group();
    fore.position.y = -0.25;
    const foreMesh = capsule(0.045, 0.19, skin);
    foreMesh.position.y = -0.12;
    fore.add(foreMesh);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), skin);
    hand.scale.set(0.82, 1.15, 0.62);
    hand.position.y = -0.255;
    fore.add(hand);

    arm.add(fore);
    arm.rotation.z = side * 0.10;
    return { arm, hand };
  }

  const armR = buildArm(1);
  const armL = buildArm(-1);
  torso.add(armR.arm, armL.arm);

  // legs + shoes
  const legMat = skin;
  const legL = capsule(0.065, 0.55, legMat);
  legL.position.set(-0.085, 0.47, 0);
  const legR = capsule(0.065, 0.55, legMat);
  legR.position.set(0.085, 0.47, 0);
  group.add(legL, legR);

  const shoeMat = mat('#27242a', 0.38);
  for (const side of [-1, 1]) {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), shoeMat);
    shoe.scale.set(0.75, 0.34, 1.35);
    shoe.position.set(side * 0.085, 0.055, 0.045);
    group.add(shoe);
  }

  // waist anchors for simulated skirt
  const waistAnchors: THREE.Object3D[] = [];
  const WAIST_COLS = 18;
  for (let c = 0; c < WAIST_COLS; c++) {
    const o = new THREE.Object3D();
    const a = (c / WAIST_COLS) * Math.PI * 2;
    o.position.set(Math.sin(a) * 0.17, 0.02, Math.cos(a) * 0.17);
    torso.add(o);
    waistAnchors.push(o);
  }

  const sleeveAnchors: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const o = new THREE.Object3D();
      const a = (k / 6) * Math.PI * 2;
      o.position.set(
        side * 0.22 + Math.sin(a) * 0.065,
        shoulderY - hipY - 0.10,
        Math.cos(a) * 0.065,
      );
      torso.add(o);
      sleeveAnchors.push(o);
    }
  }

  const hairRoots: THREE.Object3D[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const o = new THREE.Object3D();
    o.position.set(Math.sin(a) * 0.09, 0.02 + Math.cos(a) * 0.035, Math.cos(a) * 0.055 - 0.015);
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
