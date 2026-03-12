/**
 * Pixel types - re-exported from shared types for backward compatibility
 */

export { PixelType, PIXEL_PROPERTIES, type PixelProperties } from './PixelTypes';

// Legacy Pixel type for backward compatibility
export type Pixel = {
  type: import('./PixelTypes').PixelType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
};