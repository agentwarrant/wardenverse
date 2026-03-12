/**
 * BlockVisual - Visual representation of a blockchain block
 * Renders as a growing planet/star with pixel art effects
 */

import type { Engine, Block } from '../core/Engine';
import { PixelWorld } from '../core/PixelWorld';
import { PixelType } from '../core/PixelTypes';

export class BlockVisual {
  private block: Block;
  private world: PixelWorld;
  private x: number = 0;
  private y: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private size: number = 20;
  private targetSize: number = 20;
  private pulsePhase: number = 0;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];

  constructor(block: Block, world: PixelWorld) {
    this.block = block;
    this.world = world;
    
    // Position based on block number (create a spiral pattern)
    const angle = (block.number * 0.1) % (Math.PI * 2);
    const radius = 100 + (block.number % 10) * 30;
    this.x = world['width'] / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50;
    this.y = world['height'] / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50;
    this.targetX = this.x;
    this.targetY = this.y;
    
    // Size based on transaction count
    this.targetSize = 15 + Math.min(block.transactions.length * 2, 30);
    this.size = this.targetSize;
    
    // Create initial particle burst
    this.createSparkles(10);
  }

  private createSparkles(count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 1 + Math.random() * 2;
      this.particles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
      });
    }
  }

  update(dt: number): void {
    // Pulse animation
    this.pulsePhase += dt * 2;
    
    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt * 0.5;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    
    // Occasionally add new particles for active blocks
    if (Math.random() < 0.1 * dt) {
      this.createSparkles(2);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const pulseSize = this.size + Math.sin(this.pulsePhase) * 2;
    
    // Outer glow
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, pulseSize * 2
    );
    gradient.addColorStop(0, 'rgba(251, 191, 36, 0.3)');
    gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.1)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, pulseSize * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Main body - planet/star
    const bodyGradient = ctx.createRadialGradient(
      this.x - pulseSize * 0.3, this.y - pulseSize * 0.3, 0,
      this.x, this.y, pulseSize
    );
    bodyGradient.addColorStop(0, '#fef3c7');
    bodyGradient.addColorStop(0.3, '#fbbf24');
    bodyGradient.addColorStop(0.7, '#f59e0b');
    bodyGradient.addColorStop(1, '#b45309');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Block number label
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.block.number.toString(), this.x, this.y);
    
    // Render particles
    for (const p of this.particles) {
      ctx.fillStyle = `rgba(251, 191, 36, ${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getBlockNumber(): number {
    return this.block.number;
  }
}