import * as THREE from 'three';
import type { CharacterPreset } from '../lib/types';

export interface CharacterRig {
  group: THREE.Group;
  /** waist ring world anchors updated each frame */
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

export function buildCharacter(preset: CharacterPreset): CharacterRig {
  const group = new THREE.Group();
  const skin = mat(preset.skinTone, 0.55);
  const hairMat = new THREE.MeshStandardMaterial({
    color: preset.hairColor,
    roughness: 0.35,
    metalness: 0.1,
  });

  // proportions (character ~1.68 tall, feet at y=0)
  const hipY = 0.92;
  const shoulderY = 1.38;
  const neckY = 1.44;
  const headY = 1.58;

  // ---- torso (dressed, so cloth-colored) ----
  const torso = new THREE.Group();
  torso.position.y = hipY;
  group.add(torso);

  const dressMat = new THREE.MeshStandardMaterial({
    color: preset.dressColor,
    roughness: 0.8,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: preset.accentColor,
    roughness: 0.4,
    metalness: 0.35,
  });

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.34, 20), dressMat);
  chest.position.y = 0.3;
  torso.add(chest);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.12, 20), dressMat);
  waist.position.y = 0.1;
  torso.add(waist);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.014, 10, 24), accentMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.09;
  torso.add(belt);

  // hips block (under skirt)
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.14, 16), skin);
  hips.position.y = -0.06;
  torso.add(hips);

  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 12), skin);
  neck.position.y = neckY - hipY + 0.045;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = headY - hipY;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.098, 24, 20), skin);
  skull.scale.set(0.92, 1.08, 0.98);
  head.add(skull);
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 16), skin);
  jaw.rotation.x = Math.PI;
  jaw.position.y = -0.1;
  jaw.scale.set(1, 1, 0.85);
  head.add(jaw);
  // hair cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.104, 24, 20), hairMat);
  cap.scale.set(0.95, 1.05, 0.98);
  cap.position.set(0, 0.012, -0.006);
  head.add(cap);
  // simple facial hints
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#1a1512' });
  const eyeGeo = new THREE.SphereGeometry(0.011, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.034, 0.012, 0.086);
  head.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.034, 0.012, 0.086);
  head.add(eyeR);
  const lips = new THREE.Mesh(
    new THREE.TorusGeometry(0.016, 0.004, 8, 14),
    new THREE.MeshStandardMaterial({ color: '#a4453c', roughness: 0.5 }),
  );
  lips.position.set(0, -0.055, 0.088);
  lips.rotation.x = Math.PI / 2;
  lips.scale.set(1, 0.6, 1);
  head.add(lips);

  // ---- arms ----
  function buildArm(side: -1 | 1) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.16, shoulderY - hipY + 0.02, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.2, 6, 12), skin);
    upper.position.y = -0.13;
    arm.add(upper);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.16, 14), dressMat);
    sleeve.position.y = -0.08;
    arm.add(sleeve);
    const fore = new THREE.Group();
    fore.position.y = -0.25;
    const foreMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.2, 6, 12), skin);
    foreMesh.position.y = -0.12;
    fore.add(foreMesh);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), skin);
    hand.scale.set(0.85, 1.1, 0.5);
    hand.position.y = -0.26;
    fore.add(hand);
    arm.add(fore);
    arm.rotation.z = side * 0.12;
    return { arm, fore, hand };
  }

  const armR = buildArm(1);
  const armL = buildArm(-1);
  torso.add(armR.arm, armL.arm);

  // ---- legs (mostly hidden by skirt) ----
  const legGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.85, 12);
  const legL = new THREE.Mesh(legGeo, skin);
  legL.position.set(-0.07, 0.44, 0);
  const legR = new THREE.Mesh(legGeo, skin);
  legR.position.set(0.07, 0.44, 0);
  group.add(legL, legR);
  const shoeMat = mat('#2a2018', 0.5);
  const shoeGeo = new THREE.BoxGeometry(0.08, 0.05, 0.16);
  const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
  shoeL.position.set(-0.07, 0.025, 0.02);
  const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
  shoeR.position.set(0.07, 0.025, 0.02);
  group.add(shoeL, shoeR);

  // ---- anchors ----
  const waistAnchors: THREE.Object3D[] = [];
  const WAIST_COLS = 16;
  for (let c = 0; c < WAIST_COLS; c++) {
    const o = new THREE.Object3D();
    const a = (c / WAIST_COLS) * Math.PI * 2;
    o.position.set(Math.sin(a) * 0.125, 0.1, Math.cos(a) * 0.125);
    torso.add(o);
    waistAnchors.push(o);
  }

  const sleeveAnchors: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const o = new THREE.Object3D();
      const a = (k / 6) * Math.PI * 2;
      o.position.set(
        side * 0.16 + Math.sin(a) * 0.05,
        shoulderY - hipY - 0.14,
        Math.cos(a) * 0.05,
      );
      torso.add(o);
      sleeveAnchors.push(o);
    }
  }

  // hair roots along scalp
  const hairRoots: THREE.Object3D[] = [];
  for (let i = 0; i < 14; i++) {
    const o = new THREE.Object3D();
    const row = i % 7;
    const a = (row / 7) * Math.PI * 2;
    const lvl = Math.floor(i / 7);
    o.position.set(Math.sin(a) * (0.075 - lvl * 0.012), (lvl === 0 ? 0.05 : 0.0), Math.cos(a) * 0.06 - 0.02);
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
