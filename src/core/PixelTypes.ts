/**
 * Shared pixel types - used by both main thread and worker
 */

export enum PixelType {
  EMPTY = 0,
  STAR = 1,
  DUST = 2,
  PLANET = 3,
  COMET = 4,
  EXPLOSION = 5,
  FIRE = 6,
  GAS = 7,
  LIQUID = 8,
  ENERGY = 9,
}

export interface PixelProperties {
  color: [number, number, number, number]; // RGBA
  gravity: number; // 0-1, how much gravity affects (negative = rises)
  spread: number; // 0-1, how much it spreads horizontally
  lifetime: number; // milliseconds, 0 = infinite
  glow: boolean;
  interactions: Partial<Record<PixelType, PixelType>>;
}

export const PIXEL_PROPERTIES: Record<PixelType, PixelProperties | null> = {
  [PixelType.EMPTY]: null,
  
  [PixelType.STAR]: {
    color: [255, 220, 100, 255],
    gravity: 0,
    spread: 0,
    lifetime: 0,
    glow: true,
    interactions: {},
  },
  
  [PixelType.DUST]: {
    color: [60, 60, 80, 150],
    gravity: 0.1,
    spread: 0.3,
    lifetime: 5000,
    glow: false,
    interactions: {},
  },
  
  [PixelType.PLANET]: {
    color: [100, 150, 200, 255],
    gravity: 0,
    spread: 0,
    lifetime: 0,
    glow: true,
    interactions: {},
  },
  
  [PixelType.COMET]: {
    color: [96, 165, 250, 255],
    gravity: 0,
    spread: 0,
    lifetime: 3000,
    glow: true,
    interactions: {},
  },
  
  [PixelType.EXPLOSION]: {
    color: [255, 100, 50, 255],
    gravity: -0.5, // Rises
    spread: 1,
    lifetime: 500,
    glow: true,
    interactions: {},
  },
  
  [PixelType.FIRE]: {
    color: [255, 150, 50, 255],
    gravity: -0.3,
    spread: 0.5,
    lifetime: 1000,
    glow: true,
    interactions: {
      [PixelType.DUST]: PixelType.FIRE,
      [PixelType.GAS]: PixelType.EXPLOSION,
    },
  },
  
  [PixelType.GAS]: {
    color: [150, 100, 200, 100],
    gravity: -0.2,
    spread: 0.8,
    lifetime: 2000,
    glow: false,
    interactions: {},
  },
  
  [PixelType.LIQUID]: {
    color: [50, 100, 200, 200],
    gravity: 0.8,
    spread: 0.6,
    lifetime: 0,
    glow: false,
    interactions: {},
  },
  
  [PixelType.ENERGY]: {
    color: [167, 139, 250, 255],
    gravity: 0,
    spread: 0,
    lifetime: 200,
    glow: true,
    interactions: {},
  },
};