/**
 * BlockVisual - Pixel art representation of a blockchain block
 * Renders as a chunky pixel-art star/planet
 */

import type { Engine, Block } from '../core/Engine';
import { PixelWorld } from '../core/PixelWorld';
import { PixelType } from '../core/PixelTypes';
import { PIXEL_SIZE } from '../core/Config';

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

// Color palettes for block types
const BLOCK_COLORS: { [pattern: string]: { [key: number]: [number, number, number] | null } } = {
  star: {
    0: null, // transparent
    1: [251, 191, 36], // outer glow
    2: [251, 217, 96], // mid
    3: [254, 243, 199], // core
    4: [255, 255, 255], // center
  },
  planet: {
    0: null,
    1: [180, 83, 9], // dark edge
    2: [245, 158, 11], // mid
    3: [251, 191, 36], // bright
    4: [254, 243, 199], // highlight
  }
};

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
    this.colors = this.activityLevel > 0.5 ? BLOCK_COLORS.star : BLOCK_COLORS.planet;
    
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
    // Handle destruction/melting
    if (this.isDestroying) {
      this.destroyProgress += dt * 1000 / this.destroyDuration;
      
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
    
    // Draw glow (still smooth for atmosphere)
    const glowSize = this.size * 2;
    const glowAlpha = 0.15 + this.activityLevel * 0.15;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, glowSize);
    glow.addColorStop(0, `rgba(251, 191, 36, ${glowAlpha})`);
    glow.addColorStop(0.5, `rgba(251, 191, 36, ${glowAlpha * 0.5})`);
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
    
    // Block number (pixelated font)
    const fontSize = Math.max(4, Math.floor(this.size * 0.3));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.block.number.toString(), px, py);
  }

  getBlockNumber(): number {
    return this.block.number;
  }
}