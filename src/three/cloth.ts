import * as THREE from 'three';

export class Cloth {
  pos: Float32Array;
  prev: Float32Array;
  pinned: Uint8Array;
  constraints: number[];
  count: number;
  damping: number;

  constructor(count: number, damping = 0.985) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.prev = new Float32Array(count * 3);
    this.pinned = new Uint8Array(count);
    this.constraints = [];
    this.damping = damping;
  }

  setPos(i: number, x: number, y: number, z: number) {
    const p = i * 3;
    this.pos[p] = this.prev[p] = x;
    this.pos[p + 1] = this.prev[p + 1] = y;
    this.pos[p + 2] = this.prev[p + 2] = z;
  }

  addConstraint(i: number, j: number) {
    const a = i * 3, b = j * 3;
    const dx = this.pos[a] - this.pos[b];
    const dy = this.pos[a + 1] - this.pos[b + 1];
    const dz = this.pos[a + 2] - this.pos[b + 2];
    this.constraints.push(i, j, Math.hypot(dx, dy, dz));
  }

  step(dt: number, gravity: number, forceAt: (i: number, out: THREE.Vector3) => void) {
    const { pos, prev, pinned, count } = this;
    const f = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      if (pinned[i]) continue;
      const p = i * 3;
      const x = pos[p], y = pos[p + 1], z = pos[p + 2];

      forceAt(i, f);
      const ax = f.x, ay = gravity + f.y, az = f.z;

      let nx = x + (x - prev[p]) * this.damping + ax * dt * dt;
      let ny = y + (y - prev[p + 1]) * this.damping + ay * dt * dt;
      let nz = z + (z - prev[p + 2]) * this.damping + az * dt * dt;

      // Hard movement cap prevents numerical explosions when a gust changes suddenly.
      const dx = nx - x, dy = ny - y, dz = nz - z;
      const d = Math.hypot(dx, dy, dz);
      const maxStep = 0.055;
      if (d > maxStep) {
        const s = maxStep / d;
        nx = x + dx * s;
        ny = y + dy * s;
        nz = z + dz * s;
      }

      prev[p] = x;
      prev[p + 1] = y;
      prev[p + 2] = z;
      pos[p] = nx;
      pos[p + 1] = ny;
      pos[p + 2] = nz;
    }
  }

  satisfy(iterations = 5) {
    const { pos, constraints, pinned } = this;

    for (let k = 0; k < iterations; k++) {
      for (let c = 0; c < constraints.length; c += 3) {
        const i = constraints[c], j = constraints[c + 1], rest = constraints[c + 2];
        const a = i * 3, b = j * 3;
        const dx = pos[b] - pos[a];
        const dy = pos[b + 1] - pos[a + 1];
        const dz = pos[b + 2] - pos[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const error = (d - rest) / d;

        const wi = pinned[i] ? 0 : 1;
        const wj = pinned[j] ? 0 : 1;
        const total = wi + wj;
        if (!total) continue;

        const correction = 0.5 * error;
        if (wi) {
          pos[a] += dx * correction * (wi / total);
          pos[a + 1] += dy * correction * (wi / total);
          pos[a + 2] += dz * correction * (wi / total);
        }
        if (wj) {
          pos[b] -= dx * correction * (wj / total);
          pos[b + 1] -= dy * correction * (wj / total);
          pos[b + 2] -= dz * correction * (wj / total);
        }
      }
    }
  }
}

export interface SkirtOptions {
  cols: number;
  rows: number;
  waistY: number;
  hemY: number;
  waistRx: number;
  waistRz: number;
  hemScale: number;
}

export function createSkirt(opt: SkirtOptions) {
  const { cols, rows, waistY, hemY, waistRx, waistRz, hemScale } = opt;
  const cloth = new Cloth(cols * rows, 0.975);

  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const y = waistY + (hemY - waistY) * t;
    const rx = waistRx * (1 + (hemScale - 1) * t);
    const rz = waistRz * (1 + (hemScale - 1) * t);

    for (let c = 0; c < cols; c++) {
      const a = (c / cols) * Math.PI * 2;
      const i = r * cols + c;
      cloth.setPos(i, Math.sin(a) * rx, y, Math.cos(a) * rz);
      if (r === 0) cloth.pinned[i] = 1;
      if (r > 0) cloth.addConstraint(i, i - cols);
      cloth.addConstraint(i, r * cols + ((c + 1) % cols));
    }
  }

  // Shear constraints make the cloth hold its shape without the old
  // over-correction that caused polygon explosions.
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const up = i - cols;
      cloth.addConstraint(i, up + ((c + 1) % cols));
      cloth.addConstraint(i, up + (c > 0 ? c - 1 : cols - 1));
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      uvs[i * 2] = c / cols;
      uvs[i * 2 + 1] = 1 - r / (rows - 1);
    }
  }

  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const c2 = (c + 1) % cols;
      const a = r * cols + c;
      const b = r * cols + c2;
      const d = (r + 1) * cols + c;
      const e = (r + 1) * cols + c2;
      indices.push(a, d, b, b, d, e);
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return { cloth, geometry };
}

export interface Strand {
  sim: Cloth;
  links: number;
  root: THREE.Vector3;
  dir: THREE.Vector3;
  segLen: number;
}

export function createHairStrands(opts: {
  roots: THREE.Vector3[];
  segLen: number;
  links: number;
  dir: THREE.Vector3;
}) {
  const { roots, segLen, links, dir } = opts;

  const strands: Strand[] = roots.map((root) => {
    const sim = new Cloth(links, 0.965);
    for (let s = 0; s < links; s++) {
      sim.setPos(
        s,
        root.x + dir.x * segLen * s,
        root.y - segLen * s * 0.9,
        root.z + dir.z * segLen * s,
      );
      if (s === 0) sim.pinned[0] = 1;
      if (s > 0) sim.addConstraint(s, s - 1);
    }
    return { sim, links, root: root.clone(), dir: dir.clone(), segLen };
  });

  const positions = new Float32Array(strands.length * links * 2 * 3);
  const indices: number[] = [];

  for (let s = 0; s < strands.length; s++) {
    for (let seg = 0; seg < links - 1; seg++) {
      const base = s * links * 2 + seg * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return { strands, geometry };
}
