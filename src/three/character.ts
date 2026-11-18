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

function skinMat(color: string, rough = 0.48) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: 0.03,
  });
}

function clothMat(color: string, rough = 0.72) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
}

/**
 * Build a higher-detail adult female character (~1.68m).
 * Improved face, eyes, hair volume, body silhouette and clothing meshes.
 * Cloth simulation still attaches via waistAnchors / sleeveAnchors.
 */
export function buildCharacter(preset: CharacterPreset): CharacterRig {
  const group = new THREE.Group();
  const skin = skinMat(preset.skinTone, 0.5);
  const hairMat = new THREE.MeshStandardMaterial({
    color: preset.hairColor,
    roughness: 0.28,
    metalness: 0.06,
  });
  const dressMat = clothMat(preset.dressColor, 0.76);
  const accentMat = new THREE.MeshStandardMaterial({
    color: preset.accentColor,
    roughness: 0.38,
    metalness: 0.22,
  });
  const topMat = clothMat(
    preset.style === 'skirt_blouse' || preset.style === 'trousers_top'
      ? '#f2ebe3'
      : preset.dressColor,
    0.68,
  );

  // Adult female proportions (meters)
  const hipY = 0.94;
  const waistY = 1.08;
  const shoulderY = 1.42;
  const neckY = 1.49;
  const headY = 1.63;

  // ---- legs ----
  const legs: THREE.Object3D[] = [];
  const legMat =
    preset.style === 'trousers_top' ? clothMat(preset.dressColor, 0.68) : skin;

  function makeLeg(side: number) {
    const leg = new THREE.Group();
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.052, 0.4, 10, 14),
      legMat,
    );
    upper.position.y = 0.74;
    leg.add(upper);

    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.38, 10, 14),
      legMat,
    );
    lower.position.y = 0.32;
    leg.add(lower);

    // knee definition
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), legMat);
    knee.position.y = 0.53;
    knee.scale.set(1.05, 0.65, 1.05);
    leg.add(knee);

    // ankle
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), legMat);
    ankle.position.y = 0.08;
    ankle.scale.set(1, 0.7, 1.1);
    leg.add(ankle);

    leg.position.set(side * 0.095, 0, 0);
    group.add(leg);
    legs.push(leg);
    return leg;
  }
  makeLeg(-1);
  makeLeg(1);

  // shoes / heels
  const shoeMat = new THREE.MeshStandardMaterial({
    color: '#1f1814',
    roughness: 0.4,
    metalness: 0.15,
  });
  for (const side of [-1, 1]) {
    const shoe = new THREE.Group();
    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.035, 0.22),
      shoeMat,
    );
    sole.position.set(0, 0.02, 0.025);
    sole.rotation.x = -0.08;
    shoe.add(sole);
    // heel
    const heel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.025, 0.055, 8),
      shoeMat,
    );
    heel.position.set(0, 0.025, -0.07);
    shoe.add(heel);
    shoe.position.set(side * 0.095, 0, 0);
    group.add(shoe);
  }

  // ---- hips / pelvis (wider adult female) ----
  const torso = new THREE.Group();
  torso.position.y = hipY;
  group.add(torso);

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.155, 24, 18), skin);
  hips.scale.set(1.12, 0.68, 0.88);
  hips.position.y = -0.015;
  torso.add(hips);

  // waist
  const waist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.125, 0.15, 24),
    skin,
  );
  waist.position.y = 0.13;
  torso.add(waist);

  // torso / bust
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 18), skin);
  chest.scale.set(1.08, 0.88, 0.78);
  chest.position.y = 0.33;
  torso.add(chest);

  // clothed torso overlay depending on style
  if (preset.style === 'long_dress' || preset.style === 'summer_dress') {
    const bodice = new THREE.Mesh(
      new THREE.CylinderGeometry(0.128, 0.118, 0.3, 24),
      dressMat,
    );
    bodice.position.y = 0.29;
    torso.add(bodice);

    // subtle neckline
    const neckline = new THREE.Mesh(
      new THREE.TorusGeometry(0.065, 0.012, 8, 20),
      dressMat,
    );
    neckline.rotation.x = Math.PI / 2;
    neckline.position.y = 0.44;
    torso.add(neckline);
  } else if (preset.style === 'skirt_blouse' || preset.style === 'trousers_top') {
    const blouse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132, 0.112, 0.32, 24),
      topMat,
    );
    blouse.position.y = 0.28;
    torso.add(blouse);

    // collar
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.016, 8, 18),
      accentMat,
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.44;
    torso.add(collar);

    // small buttons
    const btnMat = new THREE.MeshStandardMaterial({
      color: '#e8e0d4',
      roughness: 0.35,
      metalness: 0.3,
    });
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), btnMat);
      btn.position.set(0, 0.38 - i * 0.07, 0.12);
      torso.add(btn);
    }
  } else if (preset.style === 'jacket_skirt') {
    const jacket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.142, 0.128, 0.36, 24),
      dressMat,
    );
    jacket.position.y = 0.27;
    torso.add(jacket);

    // lapels
    const lapelL = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.22, 0.018),
      accentMat,
    );
    lapelL.position.set(-0.075, 0.32, 0.125);
    lapelL.rotation.z = 0.18;
    torso.add(lapelL);
    const lapelR = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.22, 0.018),
      accentMat,
    );
    lapelR.position.set(0.075, 0.32, 0.125);
    lapelR.rotation.z = -0.18;
    torso.add(lapelR);
  }

  // belt / sash
  const belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.118, 0.014, 10, 28),
    accentMat,
  );
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.13;
  torso.add(belt);

  // ---- neck + head ----
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.046, 0.11, 16),
    skin,
  );
  neck.position.y = neckY - hipY;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = headY - hipY;
  torso.add(head);

  // skull – refined adult female head
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.102, 32, 26), skin);
  skull.scale.set(0.88, 1.14, 0.94);
  head.add(skull);

  // jaw / chin (softer, more refined)
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 14), skin);
  jaw.scale.set(0.92, 0.68, 0.82);
  jaw.position.set(0, -0.095, 0.015);
  head.add(jaw);

  // cheek definition
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), skin);
    cheek.scale.set(0.7, 0.85, 0.7);
    cheek.position.set(side * 0.055, -0.025, 0.055);
    head.add(cheek);
  }

  // nose – more natural
  const noseBridge = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.012, 0.035, 6, 8),
    skin,
  );
  noseBridge.rotation.x = -0.35;
  noseBridge.position.set(0, 0.005, 0.09);
  head.add(noseBridge);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), skin);
  noseTip.scale.set(0.9, 0.75, 1.1);
  noseTip.position.set(0, -0.025, 0.1);
  head.add(noseTip);

  // eyes – smaller, more realistic proportions
  const eyeWhite = new THREE.MeshStandardMaterial({
    color: '#f8f6f0',
    roughness: 0.25,
  });
  const irisMat = new THREE.MeshStandardMaterial({
    color: '#2c2118',
    roughness: 0.22,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#0a0806' });
  const highlightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.034, 0.012, 0.086);

    // eye white (slightly flattened)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 14, 12), eyeWhite);
    ball.scale.set(1.15, 0.95, 0.85);
    eye.add(ball);

    // iris
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 12, 10), irisMat);
    iris.position.z = 0.007;
    eye.add(iris);

    // pupil
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 10, 8), pupilMat);
    pupil.position.z = 0.011;
    eye.add(pupil);

    // catchlight
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 6, 6), highlightMat);
    hl.position.set(0.003, 0.003, 0.013);
    eye.add(hl);

    // upper eyelid
    const upperLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
      skin,
    );
    upperLid.rotation.x = -0.45;
    upperLid.position.y = 0.005;
    eye.add(upperLid);

    // lower lid hint
    const lowerLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 10, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.35),
      skin,
    );
    lowerLid.rotation.x = 0.25;
    lowerLid.position.y = -0.004;
    eye.add(lowerLid);

    head.add(eye);
  }

  // eyebrows – soft arched
  const browMat = new THREE.MeshStandardMaterial({
    color: preset.hairColor,
    roughness: 0.55,
  });
  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.004, 0.028, 4, 8),
      browMat,
    );
    brow.position.set(side * 0.034, 0.038, 0.088);
    brow.rotation.z = side * -0.25;
    brow.rotation.x = -0.15;
    head.add(brow);
  }

  // lips – natural shape
  const lipMat = new THREE.MeshStandardMaterial({
    color: '#b06a62',
    roughness: 0.38,
  });
  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), lipMat);
  upperLip.scale.set(1.05, 0.32, 0.48);
  upperLip.position.set(0, -0.048, 0.09);
  head.add(upperLip);

  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 10), lipMat);
  lowerLip.scale.set(0.95, 0.38, 0.52);
  lowerLip.position.set(0, -0.062, 0.088);
  head.add(lowerLip);

  // ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), skin);
    ear.scale.set(0.38, 1.05, 0.65);
    ear.position.set(side * 0.092, -0.005, -0.005);
    head.add(ear);
  }

  // ---- hair ----
  // hair cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 28, 22), hairMat);
  cap.scale.set(0.94, 1.1, 0.97);
  cap.position.set(0, 0.025, -0.012);
  head.add(cap);

  // front fringe / bangs volume
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), hairMat);
  fringe.scale.set(1.15, 0.55, 0.7);
  fringe.position.set(0, 0.04, 0.07);
  head.add(fringe);

  // side volume
  for (const side of [-1, 1]) {
    const sideHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 14, 12),
      hairMat,
    );
    sideHair.scale.set(0.7, 1.15, 0.85);
    sideHair.position.set(side * 0.07, -0.02, -0.01);
    head.add(sideHair);
  }

  // back volume (longer)
  const backHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 16),
    hairMat,
  );
  backHair.scale.set(0.95, 1.25, 0.9);
  backHair.position.set(0, -0.06, -0.07);
  head.add(backHair);

  // lower back hair length
  const lowerBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    hairMat,
  );
  lowerBack.scale.set(0.9, 1.1, 0.75);
  lowerBack.position.set(0, -0.14, -0.06);
  head.add(lowerBack);

  // ---- arms ----
  function buildArm(side: -1 | 1) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.175, shoulderY - hipY + 0.015, 0);

    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.034, 0.24, 8, 14),
      skin,
    );
    upper.position.y = -0.15;
    arm.add(upper);

    // sleeve depending on style
    if (preset.style !== 'trousers_top') {
      const sleeveLen = preset.style === 'jacket_skirt' ? 0.22 : 0.13;
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.046, 0.05, sleeveLen, 16),
        preset.style === 'jacket_skirt' ? dressMat : topMat,
      );
      sleeve.position.y = -0.08 - (sleeveLen - 0.13) * 0.3;
      arm.add(sleeve);
    }

    const fore = new THREE.Group();
    fore.position.y = -0.3;
    const foreMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.028, 0.22, 8, 12),
      skin,
    );
    foreMesh.position.y = -0.13;
    fore.add(foreMesh);

    // detailed hand
    const hand = new THREE.Group();
    hand.position.y = -0.28;
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.068, 0.022),
      skin,
    );
    hand.add(palm);

    // fingers
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0065, 0.032, 4, 6),
        skin,
      );
      finger.position.set((f - 1.5) * 0.013, -0.048, 0);
      hand.add(finger);
    }
    // thumb
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0075, 0.024, 4, 6),
      skin,
    );
    thumb.position.set(side * 0.028, -0.015, 0.008);
    thumb.rotation.z = side * 0.55;
    hand.add(thumb);

    hand.scale.set(side === 1 ? 1 : -1, 1, 1);
    fore.add(hand);

    arm.add(fore);
    arm.rotation.z = side * 0.08;
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
    o.position.set(Math.sin(a) * 0.118, 0.1, Math.cos(a) * 0.118);
    torso.add(o);
    waistAnchors.push(o);
  }

  const sleeveAnchors: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const o = new THREE.Object3D();
      const a = (k / 6) * Math.PI * 2;
      o.position.set(
        side * 0.175 + Math.sin(a) * 0.046,
        shoulderY - hipY - 0.12,
        Math.cos(a) * 0.046,
      );
      torso.add(o);
      sleeveAnchors.push(o);
    }
  }

  // denser hair roots for better strand coverage
  const hairRoots: THREE.Object3D[] = [];
  for (let i = 0; i < 22; i++) {
    const o = new THREE.Object3D();
    const row = i % 11;
    const a = (row / 11) * Math.PI * 2 + 0.15;
    const lvl = Math.floor(i / 11);
    const r = 0.072 - lvl * 0.014;
    o.position.set(
      Math.sin(a) * r,
      lvl === 0 ? 0.065 : 0.015,
      Math.cos(a) * r * 0.88 - 0.015,
    );
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
