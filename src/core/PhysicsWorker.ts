/**
 * WebWorker for physics simulation
 * Noita-inspired pixel physics with explosive particle effects
 * Uses PIXEL_SIZE multiplier for performance (physics grid is smaller than screen)
 */

import { PixelType, PIXEL_PROPERTIES } from './PixelTypes';
import { AMBIENT_PARTICLE_DENSITY, TRAIL_SPAWN_RATE, EXPLOSION_PARTICLE_MULTIPLIER }from './Config';

// Worker message types
type InitMessage = { type: 'init'; width: number; height: number };
type UpdateMessage = { type: 'update'; dt: number };
type SetPixelMessage = { type: 'setPixel'; x: number; y: number; pixelType: PixelType };
type ResizeMessage = { type: 'resize'; width: number; height: number };
type ExplosionMessage = { type: 'explosion'; x: number; y: number; radius: number; intensity: number };

type WorkerMessage = InitMessage | UpdateMessage | SetPixelMessage | ResizeMessage | ExplosionMessage;

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'pixels'; data: Uint8Array }
  | { type: 'error'; message: string };

// Shared state
let width = 0;
let height = 0;
let pixels: Uint8Array;
let pixelData: Float32Array; // velocity, temperature, lifetime, etc.
let pendingExplosions: Array<{ x: number; y: number; radius: number; intensity: number }> = [];

function initialize(w: number, h: number): void {
  width = Math.floor(w);
  height = Math.floor(h);
  pixels = new Uint8Array(width * height);
  pixelData = new Float32Array(width * height * 4);
  
  // Initialize with empty space
  pixels.fill(PixelType.EMPTY);
  
  // Add ambient particles
  addAmbientParticles();
}

function addAmbientParticles(): void {
  // Scale particle count by grid size
  const particleCount = Math.floor(width * height * AMBIENT_PARTICLE_DENSITY);
  for (let i = 0; i < particleCount; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const idx = y * width + x;
    
    // More varied ambient particles
    const rand = Math.random();
    if (pixels[idx] === PixelType.EMPTY) {
      if (rand > 0.9) {
        pixels[idx] = PixelType.STAR;
      } else if (rand > 0.7) {
        pixels[idx] = PixelType.DUST;
      } else if (rand > 0.5) {
        pixels[idx] = PixelType.EMBER;
      }
    }
  }
}

function createExplosion(centerX: number, centerY: number, radius: number, intensity: number): void {
  const particleCount = Math.floor(intensity * EXPLOSION_PARTICLE_MULTIPLIER);
  
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const x = Math.floor(centerX + Math.cos(angle) * dist);
    const y = Math.floor(centerY + Math.sin(angle) * dist);
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const idx = y * width + x;
    
    // Create varied explosion particles
    const rand = Math.random();
    let particleType: PixelType;
    
    if (rand > 0.7) {
      particleType = PixelType.EXPLOSION;
    } else if (rand > 0.4) {
      particleType = PixelType.FIRE;
    } else if (rand > 0.2) {
      particleType = PixelType.SPARK;
    } else if (rand > 0.1) {
      particleType = PixelType.PLASMA;
    } else if (rand > 0.05) {
      particleType = PixelType.LIGHTNING;
    } else {
      particleType = PixelType.DEBRIS;
    }
    
    pixels[idx] = particleType;
    // Set velocity for outward motion
    const velAngle = angle;
    const speed = 0.5 + Math.random() * 2;
    pixelData[idx * 4] = Math.cos(velAngle) * speed; // vx
    pixelData[idx * 4 + 1] = Math.sin(velAngle) * speed; // vy
    pixelData[idx * 4 + 2] = 0; // reserved
    pixelData[idx * 4 + 3] = 0; // lifetime
  }
}

function createLightning(startX: number, startY: number, endX: number, endY: number): void {
  // Create jagged lightning path
  let x = startX;
  let y = startY;
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.floor(dist / 3));
  
  for (let i = 0; i < steps; i++) {
    const progress = i / steps;
    const jitter = (Math.random() - 0.5) * 8;
    x = Math.floor(startX + dx * progress + jitter);
    y = Math.floor(startY + dy * progress + jitter);
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const idx = y * width + x;
    pixels[idx] = PixelType.LIGHTNING;
    
    // Add branching (less frequently for performance)
    if (Math.random() > 0.9) {
      const branchAngle = Math.random() * Math.PI * 2;
      const branchLen = 3 + Math.random() * 6;
      for (let j = 0; j < branchLen; j++) {
        const bx = Math.floor(x + Math.cos(branchAngle) * j);
        const by = Math.floor(y + Math.sin(branchAngle) * j);
        if (bx >= 0 && bx < width && by >= 0 && by < height) {
          const bIdx = by * width + bx;
          if (pixels[bIdx] === PixelType.EMPTY) {
            pixels[bIdx] = PixelType.ELECTRIC;
          }
        }
      }
    }
  }
}

function updatePhysics(dt: number): void {
  // Process pending explosions
  for (const exp of pendingExplosions) {
    createExplosion(exp.x, exp.y, exp.radius, exp.intensity);
  }
  pendingExplosions = [];
  
  // Process from bottom to top for falling, top to bottom for rising
  for (let y = height - 2; y >= 0; y--) {
    const randomStart = Math.random() > 0.5 ? 0 : 1;
    const startX = randomStart === 0 ? 0 : width - 1;
    const endX = randomStart === 0 ? width : -1;
    const step = randomStart === 0 ? 1 : -1;
    
    for (let x = startX; x !== endX; x += step) {
      const idx = y * width + x;
      const pixelType = pixels[idx];
      
      if (pixelType === PixelType.EMPTY) continue;
      
      const props = PIXEL_PROPERTIES[pixelType as PixelType];
      if (!props) continue;
      
      const dataIdx = idx * 4;
      
      // Apply velocity-based movement for explosive particles
      const vx = pixelData[dataIdx];
      const vy = pixelData[dataIdx + 1];
      
      if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
        const newX = x + Math.round(vx);
        const newY = y + Math.round(vy);
        
        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
          const newIdx = newY * width + newX;
          if (pixels[newIdx] === PixelType.EMPTY) {
            swapPixels(idx, newIdx);
            // Apply drag
            pixelData[newIdx * 4] *= 0.95;
            pixelData[newIdx * 4 + 1] *= 0.95;
            continue;
          }
        }
      }
      
      // Apply gravity (positive = falls, negative = rises)
      if (props.gravity > 0) {
        const belowIdx = (y + 1) * width + x;
        
        // Check for planet collision - slide around instead of passing through
        if (y < height - 1 && pixels[belowIdx] === PixelType.PLANET) {
          // Try to slide left or right around the planet
          const dir = Math.random() > 0.5 ? 1 : -1;
          const leftIdx = y * width + (x - 1);
          const rightIdx = y * width + (x + 1);
          const leftBelowIdx = (y + 1) * width + (x - 1);
          const rightBelowIdx = (y + 1) * width + (x + 1);
          
          // Try to slide in the chosen direction
          if (dir === 1) {
            // Try right first, then left
            if (x + 1 < width && pixels[rightIdx] === PixelType.EMPTY && canMove(pixelType, idx, rightIdx)) {
              swapPixels(idx, rightIdx);
            } else if (x - 1 >= 0 && pixels[leftIdx] === PixelType.EMPTY && canMove(pixelType, idx, leftIdx)) {
              swapPixels(idx, leftIdx);
            } else if (x + 1 < width && y + 1 < height && pixels[rightBelowIdx] === PixelType.EMPTY) {
              // Slide diagonally down-right
              swapPixels(idx, rightBelowIdx);
            } else if (x - 1 >= 0 && y + 1 < height && pixels[leftBelowIdx] === PixelType.EMPTY) {
              // Slide diagonally down-left
              swapPixels(idx, leftBelowIdx);
            }
          } else {
            // Try left first, then right
            if (x - 1 >= 0 && pixels[leftIdx] === PixelType.EMPTY && canMove(pixelType, idx, leftIdx)) {
              swapPixels(idx, leftIdx);
            } else if (x + 1 < width && pixels[rightIdx] === PixelType.EMPTY && canMove(pixelType, idx, rightIdx)) {
              swapPixels(idx, rightIdx);
            } else if (x - 1 >= 0 && y + 1 < height && pixels[leftBelowIdx] === PixelType.EMPTY) {
              swapPixels(idx, leftBelowIdx);
            } else if (x + 1 < width && y + 1 < height && pixels[rightBelowIdx] === PixelType.EMPTY) {
              swapPixels(idx, rightBelowIdx);
            }
          }
        } else if (y < height - 1 && canMove(pixelType, idx, belowIdx)) {
          swapPixels(idx, belowIdx);
        } else if (y < height - 1) {
          const dir = Math.random() > 0.5 ? 1 : -1;
          const diagIdx = (y + 1) * width + (x + dir);
          if (x + dir >= 0 && x + dir < width && canMove(pixelType, idx, diagIdx)) {
            swapPixels(idx, diagIdx);
          }
        }
      } else if (props.gravity < 0) {
        const aboveIdx = (y - 1) * width + x;
        if (y > 0 && canMove(pixelType, idx, aboveIdx)) {
          swapPixels(idx, aboveIdx);
        } else if (y > 0) {
          const dir = Math.random() > 0.5 ? 1 : -1;
          const diagIdx = (y - 1) * width + (x + dir);
          if (x + dir >= 0 && x + dir < width && canMove(pixelType, idx, diagIdx)) {
            swapPixels(idx, diagIdx);
          }
        }
      }
      
      // Spread (liquids, gases) - reduced rate for performance
      if (props.spread > 0 && Math.random() < props.spread * 0.25) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        const sideIdx = y * width + (x + dir);
        if (x + dir >= 0 && x + dir < width && pixels[sideIdx] === PixelType.EMPTY) {
          swapPixels(idx, sideIdx);
        }
      }
      
      // Trail particles - reduced rate for performance
      if (props.trail && props.trailType !== null && Math.random() < TRAIL_SPAWN_RATE * 0.5) {
        const trailOffset = Math.floor(Math.random() * 3) - 1;
        const tx = x + trailOffset;
        const ty = y + 1;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
          const trailIdx = ty * width + tx;
          if (pixels[trailIdx] === PixelType.EMPTY) {
            pixels[trailIdx] = props.trailType;
          }
        }
      }
      
      // Handle interactions
      if (props.interactions && Object.keys(props.interactions).length > 0) {
        const neighbors = [
          y > 0 ? (y - 1) * width + x : -1,
          y < height - 1 ? (y + 1) * width + x : -1,
          x > 0 ? y * width + (x - 1) : -1,
          x < width - 1 ? y * width + (x + 1) : -1,
        ];
        
        for (const nIdx of neighbors) {
          if (nIdx < 0) continue;
          const nType = pixels[nIdx] as PixelType;
          const result = props.interactions[nType];
          if (result !== undefined) {
            pixels[nIdx] = result;
          }
        }
      }
      
      // Lifetime decay
      if (props.lifetime > 0) {
        pixelData[dataIdx + 3] += dt * 1000;
        if (pixelData[dataIdx + 3] >= props.lifetime) {
          // Death explosion (reduced particle count for performance)
          if (props.explodeOnDeath !== null && props.explodeCount > 0) {
            const count = Math.min(props.explodeCount, 3); // Cap at3 for performance
            for (let i = 0; i < count; i++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = 1 + Math.random() * 2;
              const dx = Math.floor(Math.cos(angle) * dist);
              const dy = Math.floor(Math.sin(angle) * dist);
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (pixels[nIdx] === PixelType.EMPTY) {
                  pixels[nIdx] = props.explodeOnDeath;
                  pixelData[nIdx * 4] = dx * 0.3;
                  pixelData[nIdx * 4 + 1] = dy * 0.3;
                }
              }
            }
          }
          pixels[idx] = PixelType.EMPTY;
        }
      }
    }
  }
  
  // Randomly add ambient particles (reduced rate for performance)
  if (Math.random() < 0.02) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const idx = y * width + x;
    if (pixels[idx] === PixelType.EMPTY) {
      const rand = Math.random();
      if (rand > 0.7) {
        pixels[idx] = PixelType.DUST;
      } else if (rand > 0.4) {
        pixels[idx] = PixelType.EMBER;
      }
    }
  }
  
  // Occasionally create lightning between stars (reduced frequency)
  if (Math.random() < 0.0005) {
    // Find two random stars
    const stars: Array<{x: number, y: number}> = [];
    for (let i = 0; i < pixels.length && stars.length < 2; i++) {
      if (pixels[i] === PixelType.STAR || pixels[i] === PixelType.PLANET) {
        stars.push({
          x: i % width,
          y: Math.floor(i / width)
        });
      }
    }
    if (stars.length >= 2) {
      createLightning(stars[0].x, stars[0].y, stars[1].x, stars[1].y);
    }
  }
}

function canMove(fromType: PixelType, fromIdx: number, toIdx: number): boolean {
  if (toIdx < 0 || toIdx >= pixels.length) return false;
  const toType = pixels[toIdx];
  // Dust collides with PLANET (doesn't pass through)
  if (fromType === PixelType.DUST && toType === PixelType.PLANET) return false;
  return toType === PixelType.EMPTY || toType === PixelType.DUST || toType === PixelType.GAS;
}

function swapPixels(idx1: number, idx2: number): void {
  const temp = pixels[idx1];
  pixels[idx1] = pixels[idx2];
  pixels[idx2] = temp;
  
  // Also swap pixel data
  for (let i = 0; i < 4; i++) {
    const tempData = pixelData[idx1 * 4 + i];
    pixelData[idx1 * 4 + i] = pixelData[idx2 * 4 + i];
    pixelData[idx2 * 4 + i] = tempData;
  }
}

function setPixel(x: number, y: number, newType: PixelType): void {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const idx = Math.floor(y) * width + Math.floor(x);
  pixels[idx] = newType;
  // Reset lifetime counter and velocity
  pixelData[idx * 4] = 0;
  pixelData[idx * 4 + 1] = 0;
  pixelData[idx * 4 + 2] = 0;
  pixelData[idx * 4 + 3] = 0;
}

function resize(w: number, h: number): void {
  const oldPixels = pixels;
  const oldWidth = width;
  const oldHeight = height;
  
  width = Math.floor(w);
  height = Math.floor(h);
  pixels = new Uint8Array(width * height);
  pixelData = new Float32Array(width * height * 4);
  pixels.fill(PixelType.EMPTY);
  
  // Copy old pixels
  const copyWidth = Math.min(oldWidth, width);
  const copyHeight = Math.min(oldHeight, height);
  for (let y = 0; y < copyHeight; y++) {
    for (let x = 0; x < copyWidth; x++) {
      const oldIdx = y * oldWidth + x;
      const newIdx = y * width + x;
      pixels[newIdx] = oldPixels[oldIdx];
    }
  }
  
  // Add new ambient particles for expanded area
  addAmbientParticles();
}

// Worker message handler
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  
  try {
    switch (msg.type) {
      case 'init':
        initialize(msg.width, msg.height);
        self.postMessage({ type: 'ready' } as WorkerResponse);
        break;
        
      case 'update':
        updatePhysics(msg.dt);
        self.postMessage({ type: 'pixels', data: pixels } as WorkerResponse);
        break;
        
      case 'setPixel':
        setPixel(msg.x, msg.y, msg.pixelType);
        break;
        
      case 'resize':
        resize(msg.width, msg.height);
        break;
        
      case 'explosion':
        pendingExplosions.push({
          x: msg.x,
          y: msg.y,
          radius: msg.radius,
          intensity: msg.intensity
        });
        break;
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    } as WorkerResponse);
  }
};