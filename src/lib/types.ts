export type LocationId = 'garden' | 'beach' | 'park' | 'rooftop';

export interface LocationPreset {
  id: LocationId;
  name: string;
  description: string;
  /** Base ambient wind floor, 0..1 */
  ambient: number;
  /** Multiplier applied to microphone-driven gusts */
  response: number;
  /** Sky + fog colors, top and bottom of the gradient */
  skyTop: string;
  skyBottom: string;
  fogColor: string;
  fogDensity: number;
  groundColor: string;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  /** Particle style carried by the wind */
  particles: 'petals' | 'sand' | 'leaves' | 'dust';
  particleColor: string;
  particleCount: number;
}

export interface CharacterPreset {
  id: string;
  name: string;
  /** Cloth hex color for the dress */
  dressColor: string;
  /** Accent / trim hex color */
  accentColor: string;
  hairColor: string;
  skinTone: string;
  /** Max dress length, 1.0 = ankle, lower = shorter */
  dressLength: number;
  /** Dress silhouette: 0 = A-line, 1 = fitted sheath */
  fit: number;
  description: string;
}

export type Phase = 'idle' | 'listening' | 'error';

export interface WindEngineStatus {
  phase: Phase;
  level: number;
  peak: number;
  message: string | null;
}
