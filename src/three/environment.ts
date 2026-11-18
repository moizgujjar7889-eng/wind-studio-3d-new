import * as THREE from 'three';
import type { LocationPreset } from '../lib/types';

export interface EnvironmentHandle {
  group: THREE.Group;
  update(dt: number, time: number, wind01: number): void;
  dispose(): void;
}

function scatter(group: THREE.Group, count: number, build: (i: number) => THREE.Object3D, radius: number) {
  for (let i = 0; i < count; i++) {
    const o = build(i);
    const a = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * radius;
    o.position.set(Math.cos(a) * r, o.position.y, Math.sin(a) * r);
    o.rotation.y = Math.random() * Math.PI * 2;
    group.add(o);
  }
}

function makeTree(trunkColor: string, leafColor: string, h: number) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.13, h, 10),
    new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.92 }),
  );
  trunk.position.y = h / 2;
  g.add(trunk);

  // small branch hints
  for (let b = 0; b < 2; b++) {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.04, 0.5 + Math.random() * 0.4, 6),
      new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 }),
    );
    const ang = (b / 2) * Math.PI + Math.random();
    branch.position.set(Math.cos(ang) * 0.15, h * 0.55 + b * 0.3, Math.sin(ang) * 0.15);
    branch.rotation.z = Math.cos(ang) * 0.7;
    branch.rotation.x = Math.sin(ang) * 0.5;
    g.add(branch);
  }

  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.82 });
  // more layered canopy for fuller look
  for (let i = 0; i < 5; i++) {
    const s = 1 - i * 0.14;
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.7 * s, 14, 12), leafMat);
    blob.position.set(
      (Math.random() - 0.5) * 0.45,
      h + i * 0.32 - 0.1,
      (Math.random() - 0.5) * 0.45,
    );
    blob.scale.y = 0.75 + Math.random() * 0.15;
    g.add(blob);
  }
  return g;
}

export function buildEnvironment(preset: LocationPreset): EnvironmentHandle {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const animated: { mesh: THREE.Object3D; kind: 'tree' | 'grass'; phase: number }[] = [];

  // ground
  const groundGeo = new THREE.CircleGeometry(30, 48);
  const groundMat = new THREE.MeshStandardMaterial({ color: preset.groundColor, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  disposables.push(groundGeo, groundMat);

  const std = (color: string, rough = 0.8) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
    disposables.push(m);
    return m;
  };

  if (preset.id === 'garden') {
    // flower bushes + hedges
    scatter(group, 10, () => {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), std('#3e6b3a'));
      bush.position.y = 0.35;
      bush.scale.y = 0.8;
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        std(preset.particleColor, 0.6),
      );
      bloom.position.set((Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6);
      const wrap = new THREE.Group();
      wrap.add(bush, bloom);
      return wrap;
    }, 8);
    scatter(group, 8, () => makeTree('#5a4632', '#4a7c42', 2.2), 10);
    // stone path
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 20), std('#b9b3a6'));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, -6);
    group.add(path);
  } else if (preset.id === 'beach') {
    // water plane
    const waterGeo = new THREE.PlaneGeometry(60, 60, 1, 1);
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#2e7ea8',
      roughness: 0.15,
      metalness: 0.3,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.05, -14);
    group.add(water);
    disposables.push(waterGeo, waterMat);
    // palm trees
    scatter(group, 6, () => {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.12, 3.2, 8),
        std('#8a6a4a'),
      );
      trunk.position.y = 1.6;
      trunk.rotation.z = (Math.random() - 0.5) * 0.2;
      palm.add(trunk);
      const frondMat = std('#3f7a4a');
      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.6, 4), frondMat);
        const a = (f / 6) * Math.PI * 2;
        frond.position.set(Math.cos(a) * 0.6, 3.2, Math.sin(a) * 0.6);
        frond.rotation.z = Math.cos(a) * 1.2;
        frond.rotation.x = Math.sin(a) * 1.2;
        palm.add(frond);
      }
      return palm;
    }, 9);
  } else if (preset.id === 'park') {
    scatter(group, 12, () => makeTree('#5a4632', '#c77f35', 2.8), 12);
    // benches
    scatter(group, 3, () => {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.4), std('#7a5a3a'));
      seat.position.y = 0.45;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.05), std('#7a5a3a'));
      back.position.set(0, 0.68, -0.18);
      bench.add(seat, back);
      for (const s of [-0.5, 0.5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.35), std('#4a4a4a'));
        leg.position.set(s, 0.22, 0);
        bench.add(leg);
      }
      return bench;
    }, 6);
    // lamp posts
    scatter(group, 4, () => {
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3, 8), std('#333a44'));
      pole.position.y = 1.5;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#ffe9b8', emissive: '#ffdf9e', emissiveIntensity: 1.4 }),
      );
      bulb.position.y = 3.05;
      lamp.add(pole, bulb);
      return lamp;
    }, 8);
  } else if (preset.id === 'rooftop') {
    // rooftop: concrete slab, parapet, city silhouettes, AC units
    const slabGeo = new THREE.BoxGeometry(14, 0.4, 14);
    const slab = new THREE.Mesh(slabGeo, std('#4a4f58', 0.9));
    slab.position.y = -0.2;
    group.add(slab);
    disposables.push(slabGeo);
    const parapetGeo = new THREE.BoxGeometry(14, 0.5, 0.25);
    for (const [px, pz, ry] of [[0, -7, 0], [0, 7, 0], [-7, 0, Math.PI / 2], [7, 0, Math.PI / 2]] as const) {
      const wall = new THREE.Mesh(parapetGeo, std('#3d424b'));
      wall.position.set(px, 0.25, pz);
      wall.rotation.y = ry;
      group.add(wall);
    }
    disposables.push(parapetGeo);
    // skyline
    scatter(group, 14, () => {
      const h = 6 + Math.random() * 14;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(2 + Math.random() * 3, h, 2 + Math.random() * 3),
        std('#232a38', 0.95),
      );
      const a = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 14;
      b.position.set(Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r);
      return b;
    }, 0);
    // AC units + antenna
    scatter(group, 3, () => {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), std('#8a9099', 0.7));
      ac.position.y = 0.3;
      const wrap = new THREE.Group();
      wrap.add(ac);
      return wrap;
    }, 4);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 3.4, 6), std('#6a7078'));
    ant.position.set(2.5, 1.7, -2.5);
    group.add(ant);
  } else if (preset.id === 'terrace') {
    // stone terrace with planters
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.15, 32), std('#9a9588'));
    deck.position.y = 0.05;
    group.add(deck);
    scatter(group, 8, () => {
      const pot = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 10), std('#7a6a5a'));
      base.position.y = 0.2;
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), std('#3a6a3a'));
      plant.position.y = 0.55;
      pot.add(base, plant);
      return pot;
    }, 5);
    scatter(group, 4, () => makeTree('#5a4632', '#4a7c42', 2.0), 7);
  } else if (preset.id === 'forest') {
    scatter(group, 22, () => makeTree('#4a3a28', '#2f5a2a', 2.5 + Math.random() * 1.8), 14);
    scatter(group, 30, () => {
      const g = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 5), std('#3a6a32'));
      g.position.y = 0.15;
      return g;
    }, 6);
  } else if (preset.id === 'courtyard') {
    // modern paved courtyard with benches and planters
    const paver = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 12), std('#6a6860'));
    paver.position.y = 0.02;
    group.add(paver);
    scatter(group, 6, () => {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.4), std('#3a3a3a'));
      seat.position.y = 0.42;
      bench.add(seat);
      for (const s of [-0.55, 0.55]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.3), std('#2a2a2a'));
        leg.position.set(s, 0.21, 0);
        bench.add(leg);
      }
      return bench;
    }, 5);
    scatter(group, 5, () => {
      const pot = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), std('#555555'));
      base.position.y = 0.25;
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), std('#3a6a3a'));
      plant.position.y = 0.65;
      pot.add(base, plant);
      return pot;
    }, 4);
  }

  // ---- wind particles ----
  const count = preset.particleCount;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(count * 3);
  const pSeed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 16;
    pPos[i * 3 + 1] = Math.random() * 4;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    pSeed[i] = Math.random() * 100;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: preset.particleColor,
    size: preset.particles === 'sand' ? 0.045 : 0.075,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  group.add(points);
  disposables.push(pGeo, pMat);

  const baseY = pPos.slice();

  function update(dt: number, time: number, wind01: number) {
    // particles stream downwind, wrapping around the volume
    const speed = 0.6 + wind01 * 9;
    for (let i = 0; i < count; i++) {
      const p = i * 3;
      pPos[p] -= speed * dt * (0.8 + 0.4 * Math.sin(pSeed[i]));
      pPos[p + 1] =
        baseY[p + 1] +
        Math.sin(time * (1 + wind01 * 2) + pSeed[i]) * (0.15 + wind01 * 0.9);
      pPos[p + 2] += Math.sin(time * 1.5 + pSeed[i] * 2) * dt * (0.3 + wind01 * 2.5);
      if (pPos[p] < -9) {
        pPos[p] = 9;
        baseY[p + 1] = Math.random() * 4;
      }
    }
    (pGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    // trees sway
    for (const a of animated) {
      a.mesh.rotation.z = Math.sin(time * 1.8 + a.phase) * 0.02 * (0.3 + wind01 * 2);
      a.mesh.rotation.x = Math.cos(time * 1.5 + a.phase) * 0.015 * (0.3 + wind01 * 2);
    }
  }

  // register swaying props: groups whose first child is a tall trunk
  group.children.forEach((o) => {
    if (!(o instanceof THREE.Group)) return;
    const first = o.children[0];
    if (first instanceof THREE.Mesh && first.geometry instanceof THREE.CylinderGeometry && first.geometry.parameters.height >= 2) {
      animated.push({ mesh: o, kind: 'tree', phase: Math.random() * 10 });
    }
  });

  function dispose() {
    disposables.forEach((d) => d.dispose());
  }

  return { group, update, dispose };
}
