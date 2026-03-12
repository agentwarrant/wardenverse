/**
 * TransactionVisual - Visual representation of a transaction
 * Renders as a comet/shooting star traveling between blocks
 */

import { PixelWorld } from '../core/PixelWorld';
import type { Transaction } from '../data/BlockchainDataSource';

export class TransactionVisual {
  private tx: Transaction;
  private world: PixelWorld;
  private x: number = 0;
  private y: number = 0;
  private vx: number = 0;
  private vy: number = 0;
  private life: number = 1;
  private trail: Array<{ x: number; y: number; life: number }> = [];

  constructor(tx: Transaction, world: PixelWorld) {
    this.tx = tx;
    this.world = world;
    
    // Start from a random edge
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: // Top
        this.x = Math.random() * world['width'];
        this.y = 0;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = 1 + Math.random() * 2;
        break;
      case 1: // Right
        this.x = world['width'];
        this.y = Math.random() * world['height'];
        this.vx = -(1 + Math.random() * 2);
        this.vy = (Math.random() - 0.5) * 2;
        break;
      case 2: // Bottom
        this.x = Math.random() * world['width'];
        this.y = world['height'];
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -(1 + Math.random() * 2);
        break;
      case 3: // Left
        this.x = 0;
        this.y = Math.random() * world['height'];
        this.vx = 1 + Math.random() * 2;
        this.vy = (Math.random() - 0.5) * 2;
        break;
    }
  }

  update(dt: number): void {
    // Move
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    
    // Add to trail
    this.trail.push({ x: this.x, y: this.y, life: 1 });
    
    // Update trail
    for (const t of this.trail) {
      t.life -= dt * 2;
    }
    this.trail = this.trail.filter(t => t.life > 0);
    
    // Decrease life when off screen
    if (this.x < -50 || this.x > this.world['width'] + 50 ||
        this.y < -50 || this.y > this.world['height'] + 50) {
      this.life -= dt;
    }
    
    // Limit trail length
    if (this.trail.length > 20) {
      this.trail.shift();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = t.life * 0.5;
      const size = 3 + (i / this.trail.length) * 2;
      
      // Color based on transaction type
      let color: string;
      switch (this.tx.type) {
        case 'token':
          color = `rgba(52, 211, 153, ${alpha})`; // Green
          break;
        case 'contract':
          color = `rgba(244, 114, 182, ${alpha})`; // Pink
          break;
        default:
          color = `rgba(96, 165, 250, ${alpha})`; // Blue
      }
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Main comet head
    const headGradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, 8
    );
    
    let color1: string, color2: string;
    switch (this.tx.type) {
      case 'token':
        color1 = '#34d399';
        color2 = 'rgba(52, 211, 153, 0)';
        break;
      case 'contract':
        color1 = '#f472b6';
        color2 = 'rgba(244, 114, 182, 0)';
        break;
      default:
        color1 = '#60a5fa';
        color2 = 'rgba(96, 165, 250, 0)';
    }
    
    headGradient.addColorStop(0, color1);
    headGradient.addColorStop(1, color2);
    
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  isComplete(): boolean {
    return this.life <= 0;
  }
}