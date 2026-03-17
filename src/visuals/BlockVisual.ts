/**
 * BlockVisual - Pixel art representation of a blockchain block
 * Renders as a chunky pixel-art star/planet
 * Colors are determined by the current chain
 */

import type { Engine, Block } from '../core/Engine';
import { PixelWorld } from '../core/PixelWorld';
import { PixelType } from '../core/PixelTypes';
import { PIXEL_SIZE } from '../core/Config';
import { renderPixelNumber } from './PixelDigits';

// Predefined pixel-art block patterns (8x8 grid that gets scaled)
const BLOCK_PATTERNS = {
  star: [
    [0,0,0,1,1,0,0,0],
    [0,0,1,2,2,1,0,0],
    [0,1,2,3,3,2,1,0],
    [1,2,3,3,3,3,2,1],
    [1,2,3,3,3,3,2,1],
    [0,1,2,3,3,2,1,0],
    [0,0,1,2,2,1,0,0],
    [0,0,0,1,1,0,0,0],
  ],
  planet: [
    [0,0,1,1,1,1,0,0],
    [0,1,2,2,3,2,1,0],
    [1,2,3,3,3,3,2,1],
    [1,2,3,4,4,3,2,1],
    [1,2,3,4,4,3,2,1],
    [1,2,3,3,3,3,2,1],
    [0,1,2,2,3,2,1,0],
    [0,0,1,1,1,1,0,0],
  ]
};

// Default chain colors (will be overridden by chain-specific colors)
let currentChainColors = {
  primary: [251, 191, 36] as [number, number, number], // Yellow/gold for Warden
  glow: [251, 191, 36] as [number, number, number]
};

/**
 * Set the current chain colors for all blocks
 */
export function setChainColors(colors: { primary: [number, number, number]; glow: [number, number, number] }): void {
  currentChainColors = colors;
}

/**
 * Generate color palette from primary color
 */
function generateColorPalette(primary: [number, number, number]): { [pattern: string]: { [key: number]: [number, number, number] | null } } {
  // Generate lighter variants
  const lighter = [
    Math.min(255, primary[0] + 30),
    Math.min(255, primary[1] + 30),
    Math.min(255, primary[2] + 30)
  ] as [number, number, number];
  
  const light = [
    Math.min(255, primary[0] + 60),
    Math.min(255, primary[1] + 60),
    Math.min(255, primary[2] + 60)
  ] as [number, number, number];
  
  const lighterStill = [
    Math.min(255, primary[0] + 100),
    Math.min(255, primary[1] + 100),
    Math.min(255, primary[2] + 100)
  ] as [number, number, number];
  
  // Generate darker variants
  const darker = [
    Math.max(0, primary[0] - 80),
    Math.max(0, primary[1] - 80),
    Math.max(0, primary[2] - 80)
  ] as [number, number, number];
  
  return {
    star: {
      0: null, // transparent
      1: primary, // outer glow
      2: lighter, // mid
      3: light, // core
      4: lighterStill, // center
    },
    planet: {
      0: null,
      1: darker, // dark edge
      2: primary, // mid
      3: lighter, // bright
      4: light, // highlight
    }
  };
}

export class BlockVisual {
  private block: Block;
  private world: PixelWorld;
  private x: number = 0;
  private y: number = 0;
  private size: number = 0;
  private targetSize: number = 20;
  private pulsePhase: number = 0;
  private birthTime: number = 0;
  private activityLevel: number = 0;
  private screenWidth: number;
  private screenHeight: number;
  private pattern: number[][];
  private colors: { [key: number]: [number, number, number] | null };
  private isDestroying: boolean = false;
  private destroyProgress: number = 0;
  private destroyDuration: number = 800; // ms to melt
  private lastGridX: number = -1;
  private lastGridY: number = -1;
  private lastGridSize: number = 0;
  private lifespan: number = 2 * 60 * 1000; // 2 minutes in milliseconds - blocks decay naturally
  private age: number = 0;

  constructor(block: Block, world: PixelWorld, screenWidth: number, screenHeight: number) {
    this.block = block;
    this.world = world;
    this.birthTime = Date.now();
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    
    this.initPosition();
    
    // Size based on transaction count
    this.targetSize = 20 + Math.min(block.transactions.length * 2, 25);
    this.size = 0;
    
    // Activity level
    this.activityLevel = Math.min(parseInt(block.gasUsed) / 1000000, 1);
    
    // Choose pattern based on activity
    this.pattern = this.activityLevel > 0.5 ? BLOCK_PATTERNS.star : BLOCK_PATTERNS.planet;
    
    // Generate colors from current chain colors
    const palette = generateColorPalette(currentChainColors.primary);
    this.colors = this.activityLevel > 0.5 ? palette.star : palette.planet;
    
    this.createBirthExplosion();
  }

  private initPosition(): void {
    const angle = (this.block.number * 0.1) % (Math.PI * 2);
    const radius = Math.min(this.screenWidth, this.screenHeight) * 0.15 + (this.block.number % 10) * 20;
    this.x = this.screenWidth / 2 + Math.cos(angle) * radius;
    this.y = this.screenHeight / 2 + Math.sin(angle) * radius;
  }

  updateScreenDimensions(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.initPosition();
  }

  /**
   * Initiate the melt-down destruction effect.
   * Returns true if destruction has started.
   */
  destroy(): boolean {
    if (this.isDestroying) return false;
    this.isDestroying = true;
    this.destroyProgress = 0;
    return true;
  }

  /**
   * Check if the block has fully melted and should be removed.
   */
  isDestroyed(): boolean {
    return this.isDestroying && this.destroyProgress >= 1;
  }

  /**
   * Check if the block has exceeded its lifespan and should start melting.
   */
  isExpired(): boolean {
    return this.age >= this.lifespan && !this.isDestroying;
  }

  /**
   * Get the remaining lifespan in milliseconds.
   */
  getRemainingLifespan(): number {
    return Math.max(0, this.lifespan - this.age);
  }

  /**
   * Render planet pixels into the physics grid so dust can collide with them.
   * This creates a circular area of PLANET type pixels at the block's position.
   */
  private updatePlanetPixels(): void {
    const gridPos = this.world.screenToGrid(this.x, this.y);
    const gridSize = Math.floor(this.size / PIXEL_SIZE / 2); // radius in grid units
    
    // Skip if too small or destroying
    if (gridSize < 2 || this.isDestroying) {
      this.clearPlanetPixels();
      return;
    }
    
    // Only update if position or size changed significantly
    if (Math.abs(gridPos.x - this.lastGridX) < 2 && 
        Math.abs(gridPos.y - this.lastGridY) < 2 && 
        Math.abs(gridSize - this.lastGridSize) < 1) {
      return;
    }
    
    // Clear old pixels
    this.clearPlanetPixels();
    
    // Draw circular planet in the grid
    for (let dy = -gridSize; dy <= gridSize; dy++) {
      for (let dx = -gridSize; dx <= gridSize; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= gridSize) {
          const gx = gridPos.x + dx;
          const gy = gridPos.y + dy;
          // Only set if within bounds and empty (don't overwrite other particles)
          const currentPixel = this.world.getPixel(gx, gy);
          if (currentPixel === PixelType.EMPTY) {
            this.world.setPixel(gx, gy, PixelType.PLANET);
          }
        }
      }
    }
    
    this.lastGridX = gridPos.x;
    this.lastGridY = gridPos.y;
    this.lastGridSize = gridSize;
  }

  /**
   * Clear planet pixels from the physics grid.
   */
  private clearPlanetPixels(): void {
    if (this.lastGridSize < 2 || this.lastGridX < 0 || this.lastGridY < 0) return;
    
    // Clear the circular area
    for (let dy = -this.lastGridSize - 1; dy <= this.lastGridSize + 1; dy++) {
      for (let dx = -this.lastGridSize - 1; dx <= this.lastGridSize + 1; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= this.lastGridSize + 1) {
          const gx = this.lastGridX + dx;
          const gy = this.lastGridY + dy;
          if (this.world.getPixel(gx, gy) === PixelType.PLANET) {
            this.world.setPixel(gx, gy, PixelType.EMPTY);
          }
        }
      }
    }
  }

  private createBirthExplosion(): void {
    const explosionRadius = 15 + this.targetSize / 2;
    this.world.createExplosion(this.x, this.y, explosionRadius, 1 + this.activityLevel);
    
    // Spawn some pixels
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * explosionRadius;
      this.world.setPixelScreen(
        this.x + Math.cos(angle) * dist,
        this.y + Math.sin(angle) * dist,
        Math.random() > 0.5 ? PixelType.SPARK : PixelType.FIRE
      );
    }
  }

  update(dt: number): void {
    // Track age
    this.age += dt * 1000;
    
    // Check if expired and start melting
    if (this.isExpired()) {
      this.destroy();
    }
    
    // Handle destruction/melting
    if (this.isDestroying) {
      this.destroyProgress += dt * 1000 / this.destroyDuration;
      
      // Clear planet pixels when destroying
      if (this.destroyProgress < 0.1) {
        this.clearPlanetPixels();
      }
      
      // Spawn melting particles during destruction
      const meltIntensity = 1 - this.destroyProgress;
      if (Math.random() < 0.3 * dt * 60 * meltIntensity) {
        this.spawnMeltParticle();
      }
      
      // Shrink during destruction
      this.size = this.targetSize * (1 - this.destroyProgress);
      return;
    }
    
    const age = Date.now() - this.birthTime;
    if (age < 600) {
      this.size = this.targetSize * (age / 600);
    } else {
      this.size = this.targetSize;
    }
    
    this.pulsePhase += dt * (2 + this.activityLevel);
    
    // Update planet pixels in the physics grid for dust collision
    this.updatePlanetPixels();
    
    // Spawn ambient particles
    if (Math.random() < 0.02 * dt * 60 && this.size > 5) {
      const angle = Math.random() * Math.PI * 2;
      const dist = this.size + 3 + Math.random() * 8;
      this.world.setPixelScreen(
        this.x + Math.cos(angle) * dist,
        this.y + Math.sin(angle) * dist,
        Math.random() > 0.5 ? PixelType.SPARK : PixelType.EMBER
      );
    }
  }

  /**
   * Spawn melting particles that fall down from the block.
   */
  private spawnMeltParticle(): void {
    // Random position within the block area
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.size * 0.8;
    const px = this.x + Math.cos(angle) * dist;
    const py = this.y + Math.sin(angle) * dist;
    
    // Choose melt particle type based on progress
    const rand = Math.random();
    let particleType: PixelType;
    const progress = this.destroyProgress;
    
    if (progress < 0.3) {
      // Early phase: mostly fire and embers
      particleType = rand < 0.6 ? PixelType.FIRE : PixelType.EMBER;
    } else if (progress < 0.6) {
      // Middle phase: mix of fire, embers, and smoke
      if (rand < 0.3) particleType = PixelType.FIRE;
      else if (rand < 0.6) particleType = PixelType.EMBER;
      else if (rand < 0.8) particleType = PixelType.SMOKE;
      else particleType = PixelType.DEBRIS;
    } else {
      // Late phase: mostly smoke and debris
      if (rand < 0.4) particleType = PixelType.SMOKE;
      else if (rand < 0.7) particleType = PixelType.DEBRIS;
      else particleType = PixelType.DUST;
    }
    
    this.world.setPixelScreen(px, py, particleType);
    
    // Also spawn a few extra particles for density
    if (Math.random() < 0.3) {
      const extraX = px + (Math.random() - 0.5) * 10;
      const extraY = py + Math.random() * 5;
      this.world.setPixelScreen(extraX, extraY, PixelType.SMOKE);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.size < 2) return;
    
    // Calculate pixel size for this block
    const pixelScale = Math.max(1, Math.floor(this.size / 8));
    const patternSize = 8 * pixelScale;
    
    // Position aligned to pixel grid
    const px = Math.floor(this.x / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
    const py = Math.floor(this.y / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
    
    // Draw glow (still smooth for atmosphere) - uses current chain colors
    const glowSize = this.size * 2;
    const glowAlpha = 0.15 + this.activityLevel * 0.15;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, glowSize);
    const glowColor = currentChainColors.glow;
    glow.addColorStop(0, `rgba(${glowColor[0]}, ${glowColor[1]}, ${glowColor[2]}, ${glowAlpha})`);
    glow.addColorStop(0.5, `rgba(${glowColor[0]}, ${glowColor[1]}, ${glowColor[2]}, ${glowAlpha * 0.5})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, glowSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw pixel-art block pattern
    const startX = px - patternSize / 2;
    const startY = py - patternSize / 2;
    const pulse = 0.9 + Math.sin(this.pulsePhase) * 0.1;
    
    for (let py = 0; py < 8; py++) {
      for (let px = 0; px < 8; px++) {
        const colorIdx = this.pattern[py][px];
        const color = this.colors[colorIdx];
        if (!color) continue;
        
        // Apply pulse to colors
        const r = Math.min(255, Math.floor(color[0] * pulse));
        const g = Math.min(255, Math.floor(color[1] * pulse));
        const b = Math.min(255, Math.floor(color[2] * pulse));
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(
          startX + px * pixelScale,
          startY + py * pixelScale,
          pixelScale,
          pixelScale
        );
      }
    }
    
    // Block number (pixel art digits) - show last 3 digits to fit inside block
    const last3Digits = this.block.number % 1000;
    const digitPixelScale = Math.max(1, Math.floor(this.size / 20));
    renderPixelNumber(ctx, last3Digits, px, py, digitPixelScale, '#1f2937');
  }

  getBlockNumber(): number {
    return this.block.number;
  }

  /**
   * Get the current screen position of the block center.
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Get the current visual radius for click detection.
   */
  getRadius(): number {
    return this.size;
  }

  /**
   * Get the underlying block data.
   */
  getBlock(): Block {
    return this.block;
  }

  /**
   * Check if a screen point is within the block's clickable area.
   */
  containsPoint(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Make click area slightly larger than visual size for easier clicking
    return distance <= this.size * 1.5;
  }
}