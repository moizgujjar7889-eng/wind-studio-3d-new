export type LocationId =
  | 'garden'
  | 'beach'
  | 'park'
  | 'rooftop'
  | 'terrace'
  | 'forest'
  | 'courtyard';

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

export type OutfitStyle = 'long_dress' | 'summer_dress' | 'skirt_blouse' | 'jacket_skirt' | 'trousers_top';

export interface CharacterPreset {
  id: string;
  name: string;
  /** Cloth hex color for the main garment */
  dressColor: string;
  /** Accent / trim hex color */
  accentColor: string;
  hairColor: string;
  skinTone: string;
  /** Max dress/skirt length, 1.0 = ankle, lower = shorter */
  dressLength: number;
  /** Silhouette: 0 = A-line / loose, 1 = fitted */
  fit: number;
  /** Clothing style for mesh generation */
  style: OutfitStyle;
  description: string;
}

export type Phase = 'idle' | 'listening' | 'error';

export interface WindEngineStatus {
  phase: Phase;
  level: number;
  peak: number;
  message: string | null;
}
