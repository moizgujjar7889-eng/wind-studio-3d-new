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
  /** Optional leg meshes for trousers collision / visibility */
  legs: THREE.Object3D[];
}

function skinMat(color: string, rough = 0.55) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: 0.02,
  });
}

function clothMat(color: string, rough = 0.75) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
}

/**
 * Build a more detailed adult female character (~1.68m) using refined
 * procedural geometry. Proportions target a realistic adult woman:
 * narrower waist, wider hips, natural shoulder/hip ratio, mature facial
 * structure. Clothing meshes are separate so cloth sim can attach.
 */
export function buildCharacter(preset: CharacterPreset): CharacterRig {
  const group = new THREE.Group();
  const skin = skinMat(preset.skinTone, 0.52);
  const hairMat = new THREE.MeshStandardMaterial({
    color: preset.hairColor,
    roughness: 0.32,
    metalness: 0.08,
  });
  const dressMat = clothMat(preset.dressColor, 0.78);
  const accentMat = new THREE.MeshStandardMaterial({
    color: preset.accentColor,
    roughness: 0.4,
    metalness: 0.25,
  });
  const topMat = clothMat(preset.style === 'skirt_blouse' || preset.style === 'trousers_top' ? '#f5f0e8' : preset.dressColor, 0.7);

  // Adult female proportions (meters)
  const hipY = 0.94;
  const waistY = 1.08;
  const bustY = 1.32;
  const shoulderY = 1.42;
  const neckY = 1.48;
  const headY = 1.62;

  // ---- legs ----
  const legs: THREE.Object3D[] = [];
  const legMat = preset.style === 'trousers_top' ? clothMat(preset.dressColor, 0.7) : skin;
  function makeLeg(side: number) {
    const leg = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.38, 8, 12), legMat);
    upper.position.y = 0.72;
    leg.add(upper);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.36, 8, 12), legMat);
    lower.position.y = 0.32;
    leg.add(lower);
    // knee hint
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), legMat);
    knee.position.y = 0.52;
    knee.scale.set(1, 0.7, 1);
    leg.add(knee);
    leg.position.set(side * 0.09, 0, 0);
    group.add(leg);
    legs.push(leg);
    return leg;
  }
  makeLeg(-1);
  makeLeg(1);

  // shoes
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#2a221c', roughness: 0.45, metalness: 0.1 });
  for (const side of [-1, 1]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.2), shoeMat);
    shoe.position.set(side * 0.09, 0.028, 0.02);
    shoe.castShadow = true;
    group.add(shoe);
  }

  // ---- hips / pelvis (wider for adult female) ----
  const torso = new THREE.Group();
  torso.position.y = hipY;
  group.add(torso);

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), skin);
  hips.scale.set(1.05, 0.7, 0.85);
  hips.position.y = -0.02;
  torso.add(hips);

  // waist
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.13, 0.14, 20), skin);
  waist.position.y = 0.12;
  torso.add(waist);

  // torso / bust (soft female silhouette)
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), skin);
  chest.scale.set(1.05, 0.85, 0.75);
  chest.position.y = 0.32;
  torso.add(chest);

  // clothed torso overlay depending on style
  if (preset.style === 'long_dress' || preset.style === 'summer_dress') {
    const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.28, 20), dressMat);
    bodice.position.y = 0.28;
    torso.add(bodice);
  } else if (preset.style === 'skirt_blouse' || preset.style === 'trousers_top') {
    const blouse = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.115, 0.3, 20), topMat);
    blouse.position.y = 0.28;
    torso.add(blouse);
    // collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 16), accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.42;
    torso.add(collar);
  } else if (preset.style === 'jacket_skirt') {
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.13, 0.34, 20), dressMat);
    jacket.position.y = 0.26;
    torso.add(jacket);
    const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.02), accentMat);
    lapelL.position.set(-0.08, 0.3, 0.12);
    lapelL.rotation.z = 0.2;
    torso.add(lapelL);
    const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.02), accentMat);
    lapelR.position.set(0.08, 0.3, 0.12);
    lapelR.rotation.z = -0.2;
    torso.add(lapelR);
  }

  // belt / sash
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 10, 24), accentMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.12;
  torso.add(belt);

  // ---- neck + head (adult proportions) ----
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.1, 14), skin);
  neck.position.y = neckY - hipY;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = headY - hipY;
  torso.add(head);

  // skull – slightly elongated adult female head
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 28, 22), skin);
  skull.scale.set(0.9, 1.12, 0.95);
  head.add(skull);

  // jaw / chin (softer, adult)
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), skin);
  jaw.scale.set(0.95, 0.7, 0.85);
  jaw.position.set(0, -0.09, 0.02);
  head.add(jaw);

  // nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 10), skin);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.01, 0.095);
  head.add(nose);

  // eyes
  const eyeWhite = new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.3 });
  const irisMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.25 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#0a0806' });
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.036, 0.015, 0.088);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), eyeWhite);
    eye.add(ball);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), irisMat);
    iris.position.z = 0.008;
    eye.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), pupilMat);
    pupil.position.z = 0.012;
    eye.add(pupil);
    // lid
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45),
      skin,
    );
    lid.rotation.x = -0.3;
    lid.position.y = 0.006;
    eye.add(lid);
    head.add(eye);
  }

  // eyebrows
  const browMat = new THREE.MeshStandardMaterial({ color: preset.hairColor, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.006, 0.008), browMat);
    brow.position.set(side * 0.036, 0.04, 0.09);
    brow.rotation.z = side * -0.15;
    head.add(brow);
  }

  // lips
  const lipMat = new THREE.MeshStandardMaterial({ color: '#a85a52', roughness: 0.4 });
  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), lipMat);
  upperLip.scale.set(1, 0.35, 0.5);
  upperLip.position.set(0, -0.045, 0.092);
  head.add(upperLip);
  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), lipMat);
  lowerLip.scale.set(0.95, 0.4, 0.55);
  lowerLip.position.set(0, -0.058, 0.09);
  head.add(lowerLip);

  // ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), skin);
    ear.scale.set(0.4, 1, 0.7);
    ear.position.set(side * 0.095, 0.0, 0.0);
    head.add(ear);
  }

  // hair cap + volume
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 18), hairMat);
  cap.scale.set(0.95, 1.08, 0.98);
  cap.position.set(0, 0.02, -0.01);
  head.add(cap);

  // extra hair volume at back and sides for longer styles
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), hairMat);
  backHair.scale.set(0.9, 1.1, 0.85);
  backHair.position.set(0, -0.04, -0.06);
  head.add(backHair);

  // ---- arms ----
  function buildArm(side: -1 | 1) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.17, shoulderY - hipY + 0.02, 0);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.22, 6, 12), skin);
    upper.position.y = -0.14;
    arm.add(upper);

    // short sleeve for some styles
    if (preset.style !== 'trousers_top') {
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.052, 0.14, 14),
        preset.style === 'jacket_skirt' ? dressMat : topMat,
      );
      sleeve.position.y = -0.08;
      arm.add(sleeve);
    }

    const fore = new THREE.Group();
    fore.position.y = -0.28;
    const foreMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 6, 12), skin);
    foreMesh.position.y = -0.12;
    fore.add(foreMesh);

    // more detailed hand
    const hand = new THREE.Group();
    hand.position.y = -0.26;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.025), skin);
    hand.add(palm);
    // fingers
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.035, 4, 6), skin);
      finger.position.set((f - 1.5) * 0.014, -0.05, 0);
      hand.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.025, 4, 6), skin);
    thumb.position.set(side * 0.03, -0.02, 0.01);
    thumb.rotation.z = side * 0.6;
    hand.add(thumb);
    hand.scale.set(side === 1 ? 1 : -1, 1, 1);
    fore.add(hand);

    arm.add(fore);
    arm.rotation.z = side * 0.1;
    return { arm, fore, hand };
  }

  const armR = buildArm(1);
  const armL = buildArm(-1);
  torso.add(armR.arm, armL.arm);

  // ---- anchors for cloth ----
  const waistAnchors: THREE.Object3D[] = [];
  const WAIST_COLS = 18;
  for (let c = 0; c < WAIST_COLS; c++) {
    const o = new THREE.Object3D();
    const a = (c / WAIST_COLS) * Math.PI * 2;
    o.position.set(Math.sin(a) * 0.12, 0.1, Math.cos(a) * 0.12);
    torso.add(o);
    waistAnchors.push(o);
  }

  const sleeveAnchors: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const o = new THREE.Object3D();
      const a = (k / 6) * Math.PI * 2;
      o.position.set(
        side * 0.17 + Math.sin(a) * 0.048,
        shoulderY - hipY - 0.12,
        Math.cos(a) * 0.048,
      );
      torso.add(o);
      sleeveAnchors.push(o);
    }
  }

  // denser hair roots for better strand coverage
  const hairRoots: THREE.Object3D[] = [];
  for (let i = 0; i < 18; i++) {
    const o = new THREE.Object3D();
    const row = i % 9;
    const a = (row / 9) * Math.PI * 2 + 0.2;
    const lvl = Math.floor(i / 9);
    const r = 0.07 - lvl * 0.015;
    o.position.set(Math.sin(a) * r, (lvl === 0 ? 0.06 : 0.01), Math.cos(a) * r * 0.85 - 0.02);
    head.add(o);
    hairRoots.push(o);
  }

  // cast shadows
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

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
    legs,
  };
}
