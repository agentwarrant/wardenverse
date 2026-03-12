/**
 * TransactionVisual - Visual representation of a transaction
 * Renders as a pixelated comet with Noita-style particle effects
 */

import { PixelWorld } from '../core/PixelWorld';
import { PixelType, PIXEL_PROPERTIES } from '../core/PixelTypes';
import { PIXEL_SIZE } from '../core/Config';
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
  private screenWidth: number;
  private screenHeight: number;

  constructor(tx: Transaction, world: PixelWorld, screenWidth: number, screenHeight: number) {this.tx = tx;
    this.world = world;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    
    // Scale based on transaction type
    if (tx.type === 'inference') {
      this.size = 16; // Largest - Proof Of Inference
      this.intensity = 3.0;
    } else if (tx.type === 'token') {
      this.size = 10;
      this.intensity = 1.5;
    } else if (tx.type === 'contract') {
      this.size = 9;
      this.intensity = 1.2;
    }
    
    // Start from random edge
    this.initPosition();
  }

  private initPosition(): void {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0:
        this.x = Math.random() * this.screenWidth;
        this.y = -20;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = 1.5 + Math.random() * 2;
        break;
      case 1:
        this.x = this.screenWidth + 20;
        this.y = Math.random() * this.screenHeight;
        this.vx = -(1.5 + Math.random() * 2);
        this.vy = (Math.random() - 0.5) * 2;
        break;
      case 2:
        this.x = Math.random() * this.screenWidth;
        this.y = this.screenHeight + 20;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -(1.5 + Math.random() * 2);
        break;
      case 3:
        this.x = -20;
        this.y = Math.random() * this.screenHeight;
        this.vx = 1.5 + Math.random() * 2;
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
    
    this.trail.push({ x: this.x, y: this.y, life: 1, type: this.tx.type });
    
    for (const t of this.trail) {
      t.life -= dt * 1.8;
    }
    this.trail = this.trail.filter(t => t.life > 0);
    
    // Spawn particles
    this.particleTimer += dt;
    if (this.particleTimer > 0.04) {
      this.particleTimer = 0;
      this.spawnParticles();
    }
    
    // Off-screen check
    if (this.x < -40 || this.x > this.screenWidth + 40 ||
        this.y < -40 || this.y > this.screenHeight + 40) {
      this.life -= dt * 1.5;
      if (!this.exploded) {
        this.exploded = true;
        this.createExitExplosion();
      }
    }
    
    // Limit trail
    const maxTrail = this.tx.type === 'inference' ? 35 : this.tx.type === 'token' ? 25 : this.tx.type === 'contract' ? 18 : 12;
    while (this.trail.length > maxTrail) {
      this.trail.shift();
    }
  }

  private spawnParticles(): void {
    const count = this.tx.type === 'inference' ? 4 : this.tx.type === 'token' ? 2 : this.tx.type === 'contract' ? 1 : 1;
    for (let i = 0; i < count; i++) {
      const trailIdx = Math.floor(Math.random() * Math.min(this.trail.length, 6));
      if (trailIdx < this.trail.length) {
        const t = this.trail[trailIdx];
        const px = t.x + (Math.random() - 0.5) * 5;
        const py = t.y + (Math.random() - 0.5) * 5;
        
        let pixelType: PixelType;
        switch (this.tx.type) {
          case 'inference':
            // Proof Of Inference - red/orange/fire particles
            pixelType = Math.random() > 0.4 ? PixelType.INFERENCE : Math.random() > 0.5 ? PixelType.FIRE : PixelType.EXPLOSION;
            break;
          case 'token':
            pixelType = Math.random() > 0.6 ? PixelType.TOKEN : PixelType.SPARK;
            break;
          case 'contract':
            pixelType = Math.random() > 0.6 ? PixelType.PLASMA : PixelType.ELECTRIC;
            break;
          default:
            pixelType = Math.random() > 0.7 ? PixelType.COMET : PixelType.SPARK;
        }
        this.world.setPixelScreen(px, py, pixelType);
      }
    }
  }

  private createExitExplosion(): void {
    // Proof Of Inference gets the BIGGEST red explosion
    const radius = this.tx.type === 'inference' ? 60 : this.tx.type === 'token' ? 20 : this.tx.type === 'contract' ? 16 : 10;
    this.world.createExplosion(this.x, this.y, radius, this.intensity);
    
    if (this.tx.type === 'inference') {
      // Proof Of Inference - MASSIVE red explosion with fire and plasma
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 40;
        const px = this.x + Math.cos(angle) * dist;
        const py = this.y + Math.sin(angle) * dist;
        // Mix of INFERENCE, FIRE, EXPLOSION particles for big red boom
        const types = [PixelType.INFERENCE, PixelType.FIRE, PixelType.EXPLOSION, PixelType.PLASMA];
        this.world.setPixelScreen(px, py, types[Math.floor(Math.random() * types.length)]);
      }
      // Extra fire ring
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2;
        const dist = 25 + Math.random() * 15;
        this.world.setPixelScreen(
          this.x + Math.cos(angle) * dist,
          this.y + Math.sin(angle) * dist,
          PixelType.FIRE
        );
      }
    } else if (this.tx.type === 'token') {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 12;
        this.world.setPixelScreen(
          this.x + Math.cos(angle) * dist,
          this.y + Math.sin(angle) * dist,
          PixelType.TOKEN
        );
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Quantize head position
    const px = Math.floor(this.x / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
    const py = Math.floor(this.y / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
    
    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const tpx = Math.floor(t.x / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
      const tpy = Math.floor(t.y / PIXEL_SIZE) * PIXEL_SIZE + PIXEL_SIZE / 2;
      const alpha = t.life * 0.5;
      const progress = i / this.trail.length;
      const trailSize = PIXEL_SIZE * (0.5 + progress * 0.8);
      
      let color: string;
      switch (t.type) {
        case 'inference':
          color = `rgba(255, 50, 30, ${alpha})`; // Bright red for Proof Of Inference
          break;
        case 'token':
          color = `rgba(52, 211, 153, ${alpha})`;
          break;
        case 'contract':
          color = `rgba(244, 114, 182, ${alpha})`;
          break;
        default:
          color = `rgba(96, 165, 250, ${alpha})`;
      }
      
      // Glow
      ctx.fillStyle = color.replace(/[\d.]+\)$/, `${alpha * 0.2})`);
      ctx.beginPath();
      ctx.arc(tpx, tpy, trailSize * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Core
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(tpx, tpy, trailSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Bright center for token or inference
      if ((t.type === 'token' || t.type === 'inference') && i > this.trail.length * 0.6) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(tpx, tpy, trailSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Main comet head
    const headSize = this.size;
    
    // Colors by type
    let color1: string, color2: string;
    switch (this.tx.type) {
      case 'inference':
        color1 = '#ff321e'; // Bright red for Proof Of Inference
        color2 = 'rgba(255, 50, 30, 0)';
        break;
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
    
    // Outer glow
    const glowGradient = ctx.createRadialGradient(px, py, 0, px, py, headSize * 3);
    glowGradient.addColorStop(0, color1);
    glowGradient.addColorStop(0.4, color2);
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(px, py, headSize * 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Head gradient
    const headGradient = ctx.createRadialGradient(px, py, 0, px, py, headSize);
    headGradient.addColorStop(0, '#ffffff');
    headGradient.addColorStop(0.35, color1);
    headGradient.addColorStop(1, color2);
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(px, py, headSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, headSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    // Sparkle for token or inference
    if (this.tx.type === 'token' || this.tx.type === 'inference') {
      const sparkleTime = Date.now() * 0.008;
      const sparkleCount = this.tx.type === 'inference' ? 6 : 3;
      for (let i = 0; i < sparkleCount; i++) {
        const angle = (i / sparkleCount) * Math.PI * 2 + sparkleTime;
        const dist = headSize * 1.2;
        const sx = px + Math.cos(angle) * dist;
        const sy = py + Math.sin(angle) * dist;
        // Inference gets red/orange sparkles, token gets white
        ctx.fillStyle = this.tx.type === 'inference' 
          ? `rgba(255, ${150 + Math.floor(Math.random() * 50)}, 0, 0.8)` 
          : 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(sx, sy, PIXEL_SIZE * (this.tx.type === 'inference' ? 0.6 : 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  isComplete(): boolean {
    return this.life <= 0;
  }
}