/**
 * TransactionVisual - Pixel art comet/shooting star
 * Renders as chunky pixel-art with Noita-style particle effects
 */

import { PixelWorld } from '../core/PixelWorld';
import { PixelType } from '../core/PixelTypes';
import { PIXEL_SIZE } from '../core/Config';
import type { Transaction } from '../data/BlockchainDataSource';

// Pixel-art comet patterns
const COMET_PATTERNS = {
  // Head pattern (5x5)
  head: [
    [0,1,1,1,0],
    [1,2,3,2,1],
    [1,3,4,3,1],
    [1,2,3,2,1],
    [0,1,1,1,0],
  ]
};

// Color palettes by transaction type
const COMET_COLORS: { [type: string]: { [key: number]: [number, number, number] | null } } = {
  transfer: {
    0: null,
    1: [96, 165, 250],   // outer blue
    2: [147, 197, 253],  // mid blue
    3: [191, 219, 254],  // bright blue
    4: [255, 255, 255],  // white core
  },
  token: {
    0: null,
    1: [52, 211, 153],   // outer green
    2: [110, 231, 183],  // mid green
    3: [167, 243, 208],  // bright green
    4: [255, 255, 255],  // white core
  },
  contract: {
    0: null,
    1: [244, 114, 182],  // outer pink
    2: [251, 156, 203],  // mid pink
    3: [252, 205, 229],  // bright pink
    4: [255, 255, 255],  // white core
  }
};

export class TransactionVisual {
  private tx: Transaction;
  private world: PixelWorld;
  private x: number = 0;
  private y: number = 0;
  private vx: number = 0;
  private vy: number = 0;
  private life: number = 1;
  private trail: Array<{ x: number; y: number; life: number }> = [];
  private particleTimer: number = 0;
  private exploded: boolean = false;
  private size: number = 3;
  private intensity: number = 1;
  private screenWidth: number;
  private screenHeight: number;
  private colors: { [key: number]: [number, number, number] | null };

  constructor(tx: Transaction, world: PixelWorld, screenWidth: number, screenHeight: number) {
    this.tx = tx;
    this.world = world;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    
    // Scale based on type
    if (tx.type === 'token') {
      this.size = 5;
      this.intensity = 1.5;
    } else if (tx.type === 'contract') {
      this.size = 4;
      this.intensity = 1.2;
    }
    
    this.colors = COMET_COLORS[this.tx.type] || COMET_COLORS.transfer;
    this.initPosition();
  }

  private initPosition(): void {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0:
        this.x = Math.random() * this.screenWidth;
        this.y = -15;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = 1.2 + Math.random() * 1.5;
        break;
      case 1:
        this.x = this.screenWidth + 15;
        this.y = Math.random() * this.screenHeight;
        this.vx = -(1.2 + Math.random() * 1.5);
        this.vy = (Math.random() - 0.5) * 2;
        break;
      case 2:
        this.x = Math.random() * this.screenWidth;
        this.y = this.screenHeight + 15;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -(1.2 + Math.random() * 1.5);
        break;
      case 3:
        this.x = -15;
        this.y = Math.random() * this.screenHeight;
        this.vx = 1.2 + Math.random() * 1.5;
        this.vy = (Math.random() - 0.5) * 2;
        break;
    }
  }

  updateScreenDimensions(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  update(dt: number): void {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    
    this.trail.push({ x: this.x, y: this.y, life: 1 });
    
    for (const t of this.trail) {
      t.life -= dt * 1.5;
    }
    this.trail = this.trail.filter(t => t.life > 0);
    
    // Spawn particles
    this.particleTimer += dt;
    if (this.particleTimer > 0.05) {
      this.particleTimer = 0;
      this.spawnParticles();
    }
    
    // Off-screen check
    if (this.x < -30 || this.x > this.screenWidth + 30 ||
        this.y < -30 || this.y > this.screenHeight + 30) {
      this.life -= dt * 1.5;
      if (!this.exploded) {
        this.exploded = true;
        this.createExitExplosion();
      }
    }
    
    // Limit trail
    const maxTrail = this.tx.type === 'token' ? 15 : this.tx.type === 'contract' ? 12 : 10;
    while (this.trail.length > maxTrail) {
      this.trail.shift();
    }
  }

  private spawnParticles(): void {
    if (this.trail.length < 2) return;
    
    const t = this.trail[Math.floor(Math.random() * Math.min(this.trail.length, 4))];
    const px = t.x + (Math.random() - 0.5) * 4;
    const py = t.y + (Math.random() - 0.5) * 4;
    
    const types = this.tx.type === 'token' 
      ? [PixelType.TOKEN, PixelType.SPARK]
      : this.tx.type === 'contract'
      ? [PixelType.PLASMA, PixelType.ELECTRIC]
      : [PixelType.SPARK];
    
    this.world.setPixelScreen(px, py, types[Math.floor(Math.random() * types.length)]);
    
    // For token transfers, spawn additional floating TOKEN particles (reduced amount)
    // These will float in place (TOKEN type has gravity: 0)
    if (this.tx.type === 'token' && Math.random() > 0.75) {
      const floatX = t.x + (Math.random() - 0.5) * 20;
      const floatY = t.y + (Math.random() - 0.5) * 20;
      this.world.setPixelScreen(floatX, floatY, PixelType.TOKEN);
    }
  }

  private createExitExplosion(): void {
    const radius = this.tx.type === 'token' ? 14 : this.tx.type === 'contract' ? 14 : 10;
    this.world.createExplosion(this.x, this.y, radius, this.intensity);
    
    if (this.tx.type === 'token') {
      // Spawn fewer floating TOKEN particles for coin transfer effect
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 20;
        this.world.setPixelScreen(
          this.x + Math.cos(angle) * dist,
          this.y + Math.sin(angle) * dist,
          PixelType.TOKEN
        );
      }
      // Add fewer sparkles
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 30;
        this.world.setPixelScreen(
          this.x + Math.cos(angle) * dist,
          this.y + Math.sin(angle) * dist,
          PixelType.SPARK
        );
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Draw pixel-art trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = t.life;
      const progress = i / this.trail.length;
      
      // Trail pixel aligned to grid
      const tpx = Math.floor(t.x / PIXEL_SIZE) * PIXEL_SIZE;
      const tpy = Math.floor(t.y / PIXEL_SIZE) * PIXEL_SIZE;
      const trailSize = Math.max(PIXEL_SIZE, Math.floor(PIXEL_SIZE * (0.5 + progress)));
      
      const color = this.colors[1];
      if (color) {
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.4})`;
        ctx.fillRect(tpx, tpy, trailSize, trailSize);
      }
    }
    
    // Draw pixel-art comet head
    const pattern = COMET_PATTERNS.head;
    const pixelScale = this.size;
    const patternWidth = 5 * pixelScale;
    const patternHeight = 5 * pixelScale;
    
    // Head position aligned to pixel grid
    const hx = Math.floor(this.x / PIXEL_SIZE) * PIXEL_SIZE;
    const hy = Math.floor(this.y / PIXEL_SIZE) * PIXEL_SIZE;
    const startX = hx - patternWidth / 2;
    const startY = hy - patternHeight / 2;
    
    // Draw glow (smooth, for atmosphere)
    const glowRadius = this.size * 3;
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, glowRadius);
    const baseColor = this.colors[1];
    if (baseColor) {
      glow.addColorStop(0, `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0.3)`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(hx, hy, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw pixel pattern
    for (let py = 0; py < 5; py++) {
      for (let px = 0; px < 5; px++) {
        const colorIdx = pattern[py][px];
        const color = this.colors[colorIdx];
        if (!color) continue;
        
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.fillRect(
          startX + px * pixelScale,
          startY + py * pixelScale,
          pixelScale,
          pixelScale
        );
      }
    }
    
    // White core pixel
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx - pixelScale / 2, hy - pixelScale / 2, pixelScale, pixelScale);
  }

  isComplete(): boolean {
    return this.life <= 0;
  }

  /**
   * Get the transaction hash.
   */
  getHash(): string {
    return this.tx.hash;
  }

  /**
   * Get the current screen position.
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Get the underlying transaction data.
   */
  getTransaction(): Transaction {
    return this.tx;
  }
}