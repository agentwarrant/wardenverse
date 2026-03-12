/**
 * BlockVisual - Visual representation of a blockchain block
 * Renders as a pixelated planet/star with Noita-style effects
 */

import type { Engine, Block } from '../core/Engine';
import { PixelWorld } from '../core/PixelWorld';
import { PixelType } from '../core/PixelTypes';
import { PIXEL_SIZE } from '../core/Config';

export class BlockVisual {
  private block: Block;
  private world: PixelWorld;
  private x: number = 0;
  private y: number = 0;
  private size: number = 0;
  private targetSize: number = 20;
  private pulsePhase: number = 0;
  private birthTime: number = 0;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; type: string }> = [];
  private ringParticles: Array<{ angle: number; dist: number; speed: number; size: number }> = [];
  private activityLevel: number = 0;
  private screenWidth: number;
  private screenHeight: number;

  constructor(block: Block, world: PixelWorld, screenWidth: number, screenHeight: number) {
    this.block = block;
    this.world = world;
    this.birthTime = Date.now();
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    
    // Position based on block number (spiral pattern)
    this.initPosition();
    
    // Size based on transaction count
    this.targetSize = 20 + Math.min(block.transactions.length * 3, 40);
    this.size = 0;
    
    // Activity level based on gas used
    this.activityLevel = Math.min(parseInt(block.gasUsed) / 1000000, 1);
    
    // Create birth explosion
    this.createBirthExplosion();
    this.initializeRings();
  }

  private initPosition(): void {
    const angle = (this.block.number * 0.1) % (Math.PI * 2);
    const radius = Math.min(this.screenWidth, this.screenHeight) * 0.15 + (this.block.number % 10) * 25;
    this.x = this.screenWidth / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50;
    this.y = this.screenHeight / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50;
  }

  updateScreenDimensions(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.initPosition();
  }

  private createBirthExplosion(): void {
    const explosionRadius = 20 + this.targetSize;
    this.world.createExplosion(this.x, this.y, explosionRadius, 1 + this.activityLevel);
    this.createSparkles(15 + Math.floor(this.activityLevel * 8), 'birth');
    
    // Spawn pixels
    for (let i = 0; i < 20 + this.activityLevel * 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * explosionRadius;
      const px = this.x + Math.cos(angle) * dist;
      const py = this.y + Math.sin(angle) * dist;
      const types = [PixelType.SPARK, PixelType.FIRE, PixelType.PLASMA];
      const type = types[Math.floor(Math.random() * types.length)];
      this.world.setPixelScreen(px, py, type);
    }
  }

  private createSparkles(count: number, type: 'birth' | 'active' | 'death'): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = type === 'birth' ? 2 + Math.random() * 3 : 1 + Math.random() * 1.5;
      this.particles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        type: type === 'birth' ? 'explosion' : 'sparkle'
      });
    }
  }

  private initializeRings(): void {
    const ringCount = 2 + Math.floor(this.activityLevel * 2);
    for (let i = 0; i < ringCount; i++) {
      this.ringParticles.push({
        angle: Math.random() * Math.PI * 2,
        dist: this.targetSize * 1.2 + Math.random() * 15,
        speed: 0.5 + Math.random() * 0.5,
        size: 1 + Math.random() * 1.5
      });
    }
  }

  update(dt: number): void {
    // Birth animation
    const age = Date.now() - this.birthTime;
    if (age < 800) {
      this.size = this.targetSize * (age / 800);
    } else {
      this.size = this.targetSize;
    }
    
    this.pulsePhase += dt * (2.5 + this.activityLevel * 1.5);
    
    // Update rings
    for (const ring of this.ringParticles) {
      ring.angle += dt * ring.speed;
    }
    
    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt * (p.type === 'explosion' ? 0.7 : 0.4);
    }
    this.particles = this.particles.filter(p => p.life > 0);
    
    // Spawn ambient particles
    if (Math.random() < (0.03 + this.activityLevel * 0.05) * dt * 60) {
      this.createSparkles(1, 'active');
      this.spawnWorldParticle();
    }
    
    // Fire/plasma for active blocks
    if (this.activityLevel > 0.3 && Math.random() < 0.01 * dt * 60) {
      const angle = Math.random() * Math.PI * 2;
      const dist = this.size + Math.random() * 8;
      const px = this.x + Math.cos(angle) * dist;
      const py = this.y + Math.sin(angle) * dist;
      this.world.setPixelScreen(px, py, Math.random() > 0.5 ? PixelType.FIRE : PixelType.PLASMA);
    }
  }

  private spawnWorldParticle(): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.size + 4 + Math.random() * 15;
    const px = this.x + Math.cos(angle) * dist;
    const py = this.y + Math.sin(angle) * dist;
    const types = [PixelType.SPARK, PixelType.EMBER, PixelType.DUST];
    const type = types[Math.floor(Math.random() * types.length)];
    this.world.setPixelScreen(px, py, type);
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Quantize to pixel grid for pixel-art look
    const px = Math.floor(this.x / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
    const py = Math.floor(this.y / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
    const pulseSize = this.size + Math.sin(this.pulsePhase) * 2;
    const glowIntensity = 0.4 + this.activityLevel * 0.4;
    
    // Outer glow
    const outerGlow = ctx.createRadialGradient(px, py, 0, px, py, pulseSize * 3);
    outerGlow.addColorStop(0, `rgba(251, 191, 36, ${0.15 * glowIntensity})`);
    outerGlow.addColorStop(0.5, `rgba(251, 191, 36, ${0.05 * glowIntensity})`);
    outerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(px, py, pulseSize * 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Orbital particles
    for (const ring of this.ringParticles) {
      const rx = Math.floor((px + Math.cos(ring.angle) * ring.dist) / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
      const ry = Math.floor((py + Math.sin(ring.angle) * ring.dist) / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
      ctx.fillStyle = `rgba(255, 200, 100, ${0.25 + Math.sin(this.pulsePhase + ring.angle) * 0.15})`;
      ctx.beginPath();
      ctx.arc(rx, ry, ring.size * PIXEL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Main body - planet/star
    const bodyGradient = ctx.createRadialGradient(
      px - pulseSize * 0.2, py - pulseSize * 0.2, 0,
      px, py, pulseSize
    );
    const hue = 40 - this.activityLevel * 15;
    bodyGradient.addColorStop(0, '#fef3c7');
    bodyGradient.addColorStop(0.25, '#fbbf24');
    bodyGradient.addColorStop(0.5, `hsl(${hue}, 85%, 50%)`);
    bodyGradient.addColorStop(0.75, '#b45309');
    bodyGradient.addColorStop(1, '#78350f');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(px, py, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Block number (pixelated font)
    const fontSize = Math.max(8, Math.floor(pulseSize * 0.45));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.block.number.toString(), px, py);
    
    // Render particles (pixelated)
    for (const p of this.particles) {
      const ppx = Math.floor(p.x / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
      const ppy = Math.floor(p.y / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
      const alpha = p.life;
      
      ctx.fillStyle = p.type === 'explosion' 
        ? `rgba(255, 150, 50, ${alpha * 0.4})` 
        : `rgba(251, 191, 36, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(ppx, ppy, 2 * PIXEL_SIZE * p.life, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = p.type === 'explosion'
        ? `rgba(255, 200, 100, ${alpha})`
        : `rgba(255, 255, 200, ${alpha})`;
      ctx.beginPath();
      ctx.arc(ppx, ppy, PIXEL_SIZE * (0.5 + p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Activity ring
    if (this.activityLevel > 0.5) {
      const ringAlpha = 0.25 + Math.sin(this.pulsePhase * 2) * 0.15;
      ctx.strokeStyle = `rgba(255, 100, 50, ${ringAlpha})`;
      ctx.lineWidth = PIXEL_SIZE;
      ctx.beginPath();
      ctx.arc(px, py, pulseSize * 1.3 + Math.sin(this.pulsePhase) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  getBlockNumber(): number {
    return this.block.number;
  }
}