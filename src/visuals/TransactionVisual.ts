/**
 * TransactionVisual - Visual representation of a transaction
 * Renders as a comet/shooting star with Noita-style particle effects
 */

import { PixelWorld } from '../core/PixelWorld';
import { PixelType } from '../core/PixelTypes';
import type { Transaction } from '../data/BlockchainDataSource';

export class TransactionVisual {
  private tx: Transaction;
  private world: PixelWorld;
  private x: number = 0;
  private y: number = 0;
  private vx: number = 0;
  private vy: number = 0;
  private life: number = 1;
  private trail: Array<{ x: number; y: number; life: number; type: string }> = [];
  private particleTimer: number = 0;
  private exploded: boolean = false;
  private size: number = 8;
  private intensity: number = 1;

  constructor(tx: Transaction, world: PixelWorld) {
    this.tx = tx;
    this.world = world;
    
    // Scale based on transaction value/type
    if (tx.type === 'token') {
      this.size = 12;
      this.intensity = 2;
    } else if (tx.type === 'contract') {
      this.size = 10;
      this.intensity = 1.5;
    }
    
    // Start from a random edge
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: // Top
        this.x = Math.random() * world['width'];
        this.y = 0;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = 2 + Math.random() * 3;
        break;
      case 1: // Right
        this.x = world['width'];
        this.y = Math.random() * world['height'];
        this.vx = -(2 + Math.random() * 3);
        this.vy = (Math.random() - 0.5) * 3;
        break;
      case 2: // Bottom
        this.x = Math.random() * world['width'];
        this.y = world['height'];
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = -(2 + Math.random() * 3);
        break;
      case 3: // Left
        this.x = 0;
        this.y = Math.random() * world['height'];
        this.vx = 2 + Math.random() * 3;
        this.vy = (Math.random() - 0.5) * 3;
        break;
    }
  }

  update(dt: number): void {
    // Move
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    
    // Add to trail with type-specific effects
    this.trail.push({ 
      x: this.x, 
      y: this.y, 
      life: 1,
      type: this.tx.type 
    });
    
    // Update trail
    for (const t of this.trail) {
      t.life -= dt * 2;
    }
    this.trail = this.trail.filter(t => t.life > 0);
    
    // Spawn pixel particles in the world
    this.particleTimer += dt;
    if (this.particleTimer > 0.02) {
      this.particleTimer = 0;
      this.spawnParticles();
    }
    
    // Decrease life when off screen
    if (this.x < -50 || this.x > this.world['width'] + 50 ||
        this.y < -50 || this.y > this.world['height'] + 50) {
      this.life -= dt * 2;
      
      // Create explosion when leaving
      if (!this.exploded) {
        this.exploded = true;
        this.createExitExplosion();
      }
    }
    
    // Limit trail length
    const maxTrail = this.tx.type === 'token' ? 40 : this.tx.type === 'contract' ? 30 : 25;
    while (this.trail.length > maxTrail) {
      this.trail.shift();
    }
  }

  private spawnParticles(): void {
    // Spawn particles along the trail
    const particleCount = this.tx.type === 'token' ? 5 : this.tx.type === 'contract' ? 3 : 2;
    
    for (let i = 0; i < particleCount; i++) {
      const trailIdx = Math.floor(Math.random() * Math.min(this.trail.length, 10));
      if (trailIdx < this.trail.length) {
        const t = this.trail[trailIdx];
        const px = Math.floor(t.x + (Math.random() - 0.5) * 6);
        const py = Math.floor(t.y + (Math.random() - 0.5) * 6);
        
        let pixelType: PixelType;
        switch (this.tx.type) {
          case 'token':
            pixelType = Math.random() > 0.5 ? PixelType.TOKEN : PixelType.SPARK;
            break;
          case 'contract':
            pixelType = Math.random() > 0.5 ? PixelType.PLASMA : PixelType.ELECTRIC;
            break;
          default:
            pixelType = Math.random() > 0.7 ? PixelType.COMET : PixelType.SPARK;
        }
        
        this.world.setPixel(px, py, pixelType);
      }
    }
  }

  private createExitExplosion(): void {
    // Create an explosion at the exit point
    const explosionRadius = this.tx.type === 'token' ? 30 : this.tx.type === 'contract' ? 25 : 15;
    this.world.createExplosion(
      Math.floor(this.x),
      Math.floor(this.y),
      explosionRadius,
      this.intensity
    );
    
    // For token transfers, create extra sparkle
    if (this.tx.type === 'token') {
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 20;
        const px = Math.floor(this.x + Math.cos(angle) * dist);
        const py = Math.floor(this.y + Math.sin(angle) * dist);
        this.world.setPixel(px, py, PixelType.TOKEN);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Trail with enhanced effects
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = t.life * 0.6;
      const progress = i / this.trail.length;
      const size = 2 + progress * this.size * 0.5;
      
      // Color based on transaction type with enhanced visuals
      let color: string;
      let glowColor: string;
      
      switch (t.type) {
        case 'token':
          // Bright green with gold shimmer for token transfers
          const shimmer = 0.5 + 0.5 * Math.sin(this.life * 20 + i * 0.3);
          color = `rgba(52, 211, 153, ${alpha})`;
          glowColor = `rgba(52, 211, 153, ${alpha * 0.3 * shimmer})`;
          break;
        case 'contract':
          // Pink with purple plasma for contract calls
          color = `rgba(244, 114, 182, ${alpha})`;
          glowColor = `rgba(200, 150, 255, ${alpha * 0.3})`;
          break;
        default:
          // Blue with electric glow for regular transfers
          color = `rgba(96, 165, 250, ${alpha})`;
          glowColor = `rgba(150, 200, 255, ${alpha * 0.2})`;
      }
      
      // Draw glow
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size * 2.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw particle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw bright core for token transfers
      if (t.type === 'token' && i > this.trail.length * 0.7) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Main comet head with enhanced effects
    const headGradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.size * 2
    );
    
    let color1: string, color2: string, color3: string;
    switch (this.tx.type) {
      case 'token':
        color1 = '#ffffff';
        color2 = '#34d399';
        color3 = 'rgba(52, 211, 153, 0)';
        break;
      case 'contract':
        color1 = '#ffffff';
        color2 = '#f472b6';
        color3 = 'rgba(200, 150, 255, 0)';
        break;
      default:
        color1 = '#ffffff';
        color2 = '#60a5fa';
        color3 = 'rgba(96, 165, 250, 0)';
    }
    
    headGradient.addColorStop(0, color1);
    headGradient.addColorStop(0.3, color2);
    headGradient.addColorStop(1, color3);
    
    // Outer glow
    const glowGradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.size * 4
    );
    
    switch (this.tx.type) {
      case 'token':
        glowGradient.addColorStop(0, 'rgba(52, 211, 153, 0.5)');
        glowGradient.addColorStop(0.5, 'rgba(52, 211, 153, 0.2)');
        glowGradient.addColorStop(1, 'rgba(52, 211, 153, 0)');
        break;
      case 'contract':
        glowGradient.addColorStop(0, 'rgba(244, 114, 182, 0.5)');
        glowGradient.addColorStop(0.5, 'rgba(200, 150, 255, 0.2)');
        glowGradient.addColorStop(1, 'rgba(200, 150, 255, 0)');
        break;
      default:
        glowGradient.addColorStop(0, 'rgba(96, 165, 250, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.15)');
        glowGradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
    }
    
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Bright core
    ctx.fillStyle = color1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Extra sparkle for token transfers
    if (this.tx.type === 'token') {
      const sparkleTime = Date.now() * 0.01;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + sparkleTime;
        const dist = this.size * 1.5;
        const sx = this.x + Math.cos(angle) * dist;
        const sy = this.y + Math.sin(angle) * dist;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  isComplete(): boolean {
    return this.life <= 0;
  }
}