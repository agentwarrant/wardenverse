/**
 * Global configuration for the pixel simulation
 */

// Pixel size multiplier - each game pixel is rendered as PIXEL_SIZE x PIXEL_SIZE screen pixels
// Higher values = better performance, chunkier pixel art look (Noita uses 4)
export const PIXEL_SIZE = 4;

// Maximum number of active pixels before culling (for performance)
// Reduced from 50000 to prevent memory exhaustion and frame drops
export const MAX_ACTIVE_PARTICLES = 20000;

// Physics update rate (times per second)
export const PHYSICS_RATE = 60;

// Ambient particle count (scaled by screen size)
// Reduced to prevent initial particle overload
export const AMBIENT_PARTICLE_DENSITY = 0.0005; // particles per pixel

// Trail particle spawn rate (0-1)
// Reduced to prevent particle accumulation
export const TRAIL_SPAWN_RATE = 0.08;

// Explosion particle multiplier
// Reduced to prevent particle spikes
export const EXPLOSION_PARTICLE_MULTIPLIER = 20;

// Proof Of Inference contract address
export const PROOF_OF_INFERENCE_ADDRESS = '0x510b5Df4612380c6564320d7DbbfdBe72AC0d529'.toLowerCase();