import * as THREE from 'three';

/**
 * Verlet particle cloth. Positions live in world space so wind and
 * character motion can be applied directly.
 */
export class Cloth {
  pos: Float32Array;
  prev: Float32Array;
  pinned: Uint8Array;
  /** [i, j, restLength] triplets */
  constraints: number[];
  count: number;
  damping: number;

  constructor(count: number, damping = 0.978) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.prev = new Float32Array(count * 3);
    this.pinned = new Uint8Array(count);
    this.constraints = [];
    this.damping = damping;
  }

  setPos(i: number, x: number, y: number, z: number) {
    const p = i * 3;
    this.pos[p] = x;
    this.pos[p + 1] = y;
    this.pos[p + 2] = z;
    this.prev[p] = x;
    this.prev[p + 1] = y;
    this.prev[p + 2] = z;
  }

  addConstraint(i: number, j: number) {
    const dx = this.pos[i * 3] - this.pos[j * 3];
    const dy = this.pos[i * 3 + 1] - this.pos[j * 3 + 1];
    const dz = this.pos[i * 3 + 2] - this.pos[j * 3 + 2];
    this.constraints.push(i, j, Math.sqrt(dx * dx + dy * dy + dz * dz));
  }

  step(dt: number, gravity: number, windAt: (i: number, out: THREE.Vector3) => void) {
    const { pos, prev, pinned, count } = this;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      if (pinned[i]) continue;
      const p = i * 3;
      const x = pos[p];
      const y = pos[p + 1];
      const z = pos[p + 2];
      windAt(i, tmp);
      const ax = tmp.x;
      const ay = gravity + tmp.y;
      const az = tmp.z;
      let nx = x + (x - prev[p]) * this.damping + ax * dt * dt;
      let ny = y + (y - prev[p + 1]) * this.damping + ay * dt * dt;
      let nz = z + (z - prev[p + 2]) * this.damping + az * dt * dt;
      // clamp to avoid explosions / stretching
      const mdx = nx - x;
      const mdy = ny - y;
      const mdz = nz - z;
      const maxStep = 0.06;
      const md = Math.sqrt(mdx * mdx + mdy * mdy + mdz * mdz);
      if (md > maxStep) {
        const s = maxStep / md;
        nx = x + mdx * s;
        ny = y + mdy * s;
        nz = z + mdz * s;
      }
      prev[p] = x;
      prev[p + 1] = y;
      prev[p + 2] = z;
      pos[p] = nx;
      pos[p + 1] = ny;
      pos[p + 2] = nz;
    }
  }

  satisfy(iterations = 4) {
    const { pos, constraints, pinned } = this;
    for (let k = 0; k < iterations; k++) {
      for (let c = 0; c < constraints.length; c += 3) {
        const i = constraints[c];
        const j = constraints[c + 1];
        const rest = constraints[c + 2];
        const a = i * 3;
        const b = j * 3;
        const dx = pos[b] - pos[a];
        const dy = pos[b + 1] - pos[a + 1];
        const dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - rest) / d;
        const pi = pinned[i] ? 0 : 0.5;
        const pj = pinned[j] ? 0 : 0.5;
        const total = pi + pj;
        if (total === 0) continue;
        const fx = dx * diff;
        const fy = dy * diff;
        const fz = dz * diff;
        pos[a] += fx * (pi / total) * 2;
        pos[a + 1] += fy * (pi / total) * 2;
        pos[a + 2] += fz * (pi / total) * 2;
        pos[b] -= fx * (pj / total) * 2;
        pos[b + 1] -= fy * (pj / total) * 2;
        pos[b + 2] -= fz * (pj / total) * 2;
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

/** Builds a skirt-shaped cloth: a closed tube pinned at the waist ring. */
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
      cloth.addConstraint(i, ((c + 1) % cols) === 0 ? r * cols : i + 1);
    }
  }
  // shear constraints for stability
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const up = i - cols;
      cloth.addConstraint(i, up + ((c + 1) % cols));
      if (c > 0) cloth.addConstraint(i, up + c - 1);
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
  /** initial direction, unit-ish */
  dir: THREE.Vector3;
  segLen: number;
}

/**
 * Long hair simulated as a set of Verlet strands rendered as tapering
 * ribbon strips.
 */
export function createHairStrands(opts: {
  roots: THREE.Vector3[];
  segLen: number;
  links: number;
  dir: THREE.Vector3;
}) {
  const { roots, segLen, links, dir } = opts;
  const strands: Strand[] = roots.map((root) => {
    const sim = new Cloth(links, 0.97);
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

  const vertsPerStrand = links * 2;
  const positions = new Float32Array(strands.length * vertsPerStrand * 3);
  const indices: number[] = [];
  let v = 0;
  for (let s = 0; s < strands.length; s++) {
    for (let seg = 0; seg < links - 1; seg++) {
      const base = s * vertsPerStrand + seg * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      v++;
    }
  }
  void v;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return { strands, geometry };
}
