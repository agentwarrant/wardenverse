/**
 * BlockVisual - Visual representation of a blockchain block
 * Renders as a growing planet/star with Noita-style particle effects
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
  private size: number = 0;
  private targetSize: number = 20;
  private pulsePhase: number = 0;
  private birthTime: number = 0;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; type: string }> = [];
  private ringParticles: Array<{ angle: number; dist: number; speed: number; size: number }> = [];
  private activityLevel: number = 0;

  constructor(block: Block, world: PixelWorld) {
    this.block = block;
    this.world = world;
    this.birthTime = Date.now();
    
    // Position based on block number (create a spiral pattern)
    const angle = (block.number * 0.1) % (Math.PI * 2);
    const radius = 100 + (block.number % 10) * 30;
    this.x = world['width'] / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 80;
    this.y = world['height'] / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 80;
    this.targetX = this.x;
    this.targetY = this.y;
    
    // Size based on transaction count (larger = more transactions)
    this.targetSize = 20 + Math.min(block.transactions.length * 3, 40);
    this.size = 0; // Start small for birth animation
    
    // Activity level based on gas used
    this.activityLevel = Math.min(parseInt(block.gasUsed) / 1000000, 1);
    
    // Create initial birth explosion
    this.createBirthExplosion();
    
    // Initialize orbital ring particles
    this.initializeRings();
  }

  private createBirthExplosion(): void {
    // Big birth explosion proportional to block size
    const explosionRadius = 30 + this.targetSize;
    this.world.createExplosion(
      Math.floor(this.x),
      Math.floor(this.y),
      explosionRadius,
      1 + this.activityLevel
    );
    
    // Create sparkles burst
    this.createSparkles(30 + Math.floor(this.activityLevel * 20), 'birth');
    
    // Spawn pixels directly in the world
    for (let i = 0; i < 50 + this.activityLevel * 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * explosionRadius;
      const px = Math.floor(this.x + Math.cos(angle) * dist);
      const py = Math.floor(this.y + Math.sin(angle) * dist);
      
      // Varied particle types for explosion
      const types = [PixelType.SPARK, PixelType.FIRE, PixelType.PLASMA, PixelType.ENERGY, PixelType.DEBRIS];
      const type = types[Math.floor(Math.random() * types.length)];
      this.world.setPixel(px, py, type);
    }
  }

  private createSparkles(count: number, type: 'birth' | 'active' | 'death'): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = type === 'birth' ? 2 + Math.random() * 4 : 1 + Math.random() * 2;
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
    // Create orbital particles around the block
    const ringCount = 3 + Math.floor(this.activityLevel * 3);
    for (let i = 0; i < ringCount; i++) {
      this.ringParticles.push({
        angle: Math.random() * Math.PI * 2,
        dist: this.targetSize * 1.5 + Math.random() * 20,
        speed: 0.5 + Math.random() * 1,
        size: 1 + Math.random() * 2
      });
    }
  }

  update(dt: number): void {
    // Birth animation - grow from nothing
    const age = Date.now() - this.birthTime;
    if (age < 1000) {
      this.size = this.targetSize * (age / 1000);
    } else {
      this.size = this.targetSize;
    }
    
    // Pulse animation based on activity
    this.pulsePhase += dt * (3 + this.activityLevel * 2);
    
    // Update orbital rings
    for (const ring of this.ringParticles) {
      ring.angle += dt * ring.speed;
    }
    
    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt * (p.type === 'explosion' ? 0.8 : 0.5);
    }
    this.particles = this.particles.filter(p => p.life > 0);
    
    // Spawn ambient particles based on activity
    if (Math.random() < (0.05 + this.activityLevel * 0.1) * dt * 60) {
      this.createSparkles(1 + Math.floor(this.activityLevel * 2), 'active');
      this.spawnWorldParticle();
    }
    
    // Occasionally spawn fire/plasma for active blocks
    if (this.activityLevel > 0.3 && Math.random() < 0.02 * dt * 60) {
      const angle = Math.random() * Math.PI * 2;
      const dist = this.size + Math.random() * 10;
      const px = Math.floor(this.x + Math.cos(angle) * dist);
      const py = Math.floor(this.y + Math.sin(angle) * dist);
      this.world.setPixel(px, py, Math.random() > 0.5 ? PixelType.FIRE : PixelType.PLASMA);
    }
  }

  private spawnWorldParticle(): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.size + 5 + Math.random() * 20;
    const px = Math.floor(this.x + Math.cos(angle) * dist);
    const py = Math.floor(this.y + Math.sin(angle) * dist);
    
    const types = [PixelType.SPARK, PixelType.EMBER, PixelType.DUST];
    const type = types[Math.floor(Math.random() * types.length)];
    this.world.setPixel(px, py, type);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const pulseSize = this.size + Math.sin(this.pulsePhase) * 3;
    const glowIntensity = 0.5 + this.activityLevel * 0.5;
    
    // Outer ambient glow (larger, softer)
    const ambientGlow = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, pulseSize * 4
    );
    ambientGlow.addColorStop(0, `rgba(251, 191, 36, ${0.2 * glowIntensity})`);
    ambientGlow.addColorStop(0.3, `rgba(251, 191, 36, ${0.1 * glowIntensity})`);
    ambientGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGlow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, pulseSize * 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner glow
    const innerGlow = ctx.createRadialGradient(
      this.x, this.y, pulseSize * 0.5,
      this.x, this.y, pulseSize * 2
    );
    innerGlow.addColorStop(0, `rgba(251, 191, 36, ${0.4 * glowIntensity})`);
    innerGlow.addColorStop(0.5, `rgba(251, 191, 36, ${0.2 * glowIntensity})`);
    innerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, pulseSize * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Render orbital ring particles
    for (const ring of this.ringParticles) {
      const rx = this.x + Math.cos(ring.angle) * (ring.dist + Math.sin(this.pulsePhase * 0.5) * 3);
      const ry = this.y + Math.sin(ring.angle) * (ring.dist + Math.sin(this.pulsePhase * 0.5) * 3);
      
      ctx.fillStyle = `rgba(255, 200, 100, ${0.3 + Math.sin(this.pulsePhase + ring.angle) * 0.2})`;
      ctx.beginPath();
      ctx.arc(rx, ry, ring.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Main body - planet/star with atmospheric layers
    const bodyGradient = ctx.createRadialGradient(
      this.x - pulseSize * 0.3, this.y - pulseSize * 0.3, 0,
      this.x, this.y, pulseSize
    );
    
    // Color based on activity level
    const activityHue = 40 - this.activityLevel * 20; // From gold to orange/red
    bodyGradient.addColorStop(0, '#fef3c7');
    bodyGradient.addColorStop(0.2, '#fbbf24');
    bodyGradient.addColorStop(0.5, `hsl(${activityHue}, 90%, 50%)`);
    bodyGradient.addColorStop(0.8, '#b45309');
    bodyGradient.addColorStop(1, '#78350f');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Surface texture (subtle spots)
    for (let i = 0; i < 3; i++) {
      const spotAngle = (i / 3) * Math.PI * 2 + this.pulsePhase * 0.1;
      const spotDist = pulseSize * 0.4;
      const spotX = this.x + Math.cos(spotAngle) * spotDist;
      const spotY = this.y + Math.sin(spotAngle) * spotDist;
      const spotSize = pulseSize * 0.15;
      
      ctx.fillStyle = 'rgba(180, 83, 9, 0.3)';
      ctx.beginPath();
      ctx.arc(spotX, spotY, spotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Block number label
    ctx.font = `bold ${Math.max(8, Math.floor(pulseSize * 0.5))}px Inter, sans-serif`;
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.block.number.toString(), this.x, this.y);
    
    // Render particles with trails
    for (const p of this.particles) {
      const alpha = p.life;
      
      // Particle trail
      ctx.fillStyle = p.type === 'explosion' 
        ? `rgba(255, 150, 50, ${alpha * 0.3})` 
        : `rgba(251, 191, 36, ${alpha * 0.2})`;
      ctx.beginPath();
      ctx.arc(p.x - p.vx * 2, p.y - p.vy * 2, 3 * p.life, 0, Math.PI * 2);
      ctx.fill();
      
      // Particle core
      ctx.fillStyle = p.type === 'explosion'
        ? `rgba(255, 200, 100, ${alpha})`
        : `rgba(255, 255, 200, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + p.life * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Activity indicator - pulsing ring for high-activity blocks
    if (this.activityLevel > 0.5) {
      const ringAlpha = 0.3 + Math.sin(this.pulsePhase * 2) * 0.2;
      ctx.strokeStyle = `rgba(255, 100, 50, ${ringAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, pulseSize * 1.5 + Math.sin(this.pulsePhase) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  getBlockNumber(): number {
    return this.block.number;
  }
}