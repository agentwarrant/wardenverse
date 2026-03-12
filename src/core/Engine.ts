/**
 * Core rendering engine with Noita-style pixel physics simulation
 * Uses WebWorker for off-main-thread physics computation
 */

import { PixelWorld } from './PixelWorld';
import { PixelType } from './PixelTypes';
import { BlockVisual } from '../visuals/BlockVisual';
import { TransactionVisual } from '../visuals/TransactionVisual';

export interface Block {
  number: number;
  hash: string;
  timestamp: number;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
}

export interface Transaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  type: 'transfer' | 'contract' | 'token';
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: PixelWorld;
  private running: boolean = false;
  private lastTime: number = 0;
  private blocks: Map<number, BlockVisual> = new Map();
  private pendingTransactions: TransactionVisual[] = [];
  private mouseX: number = 0;
  private mouseY: number = 0;
  private fpsElement: HTMLElement | null;
  private resolutionElement: HTMLElement | null;
  private blockCountElement: HTMLElement | null;
  private txCountElement: HTMLElement | null;
  private time: number = 0;
  private ambientParticleTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.world = new PixelWorld(800, 600);
    this.fpsElement = document.getElementById('fps');
    this.resolutionElement = document.getElementById('resolution');
    this.blockCountElement = document.getElementById('block-count');
    this.txCountElement = document.getElementById('tx-count');
    
    this.setupCanvas();
    this.setupEventListeners();
  }

  private setupCanvas(): void {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.scale(dpr, dpr);
      this.world.resize(rect.width, rect.height);
    };
    
    resize();
    window.addEventListener('resize', resize);
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });
    
    // Click to add particles - varied explosion types
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Create a big explosion at click location
      this.world.createExplosion(x, y, 40, 2);
      
      // Add varied particles
      for (let i = 0; i < 50; i++) {
        const px = x + (Math.random() - 0.5) * 60;
        const py = y + (Math.random() - 0.5) * 60;
        const types = [
          PixelType.FIRE, PixelType.GAS, PixelType.EXPLOSION, 
          PixelType.ENERGY, PixelType.PLASMA, PixelType.SPARK,
          PixelType.DEBRIS, PixelType.EMBER
        ];
        const type = types[Math.floor(Math.random() * types.length)];
        this.world.setPixel(px, py, type);
      }
    });
    
    // Right-click for lightning
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Create lightning effect
      for (let i = 0; i < 20; i++) {
        const lx = x + (Math.random() - 0.5) * 100;
        const ly = y + (Math.random() - 0.5) * 100;
        this.world.setPixel(lx, ly, PixelType.LIGHTNING);
      }
      
      // Add electric particles
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 50;
        const ex = Math.floor(x + Math.cos(angle) * dist);
        const ey = Math.floor(y + Math.sin(angle) * dist);
        this.world.setPixel(ex, ey, PixelType.ELECTRIC);
      }
    });
    
    // Mouse drag for continuous particle spray
    let isDragging = false;
    let lastDragX = 0;
    let lastDragY = 0;
    
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        lastDragX = e.clientX - this.canvas.getBoundingClientRect().left;
        lastDragY = e.clientY - this.canvas.getBoundingClientRect().top;
      }
    });
    
    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      isDragging = false;
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Spray particles along the drag path
        const dx = x - lastDragX;
        const dy = y - lastDragY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(dist / 3));
        
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const px = lastDragX + dx * t + (Math.random() - 0.5) * 10;
          const py = lastDragY + dy * t + (Math.random() - 0.5) * 10;
          
          // Cycle through particle types for variety
          const types = [
            PixelType.FIRE, PixelType.SPARK, PixelType.PLASMA,
            PixelType.ENERGY, PixelType.GAS, PixelType.EMBER
          ];
          const type = types[Math.floor((this.time * 10 + i) % types.length)];
          this.world.setPixel(px, py, type);
        }
        
        lastDragX = x;
        lastDragY = y;
      }
    });
  }

  addBlock(block: Block): void {
    const visual = new BlockVisual(block, this.world);
    this.blocks.set(block.number, visual);
    this.world.addBlockEntity(visual);
    
    // Remove old blocks if we have too many
    if (this.blocks.size > 50) {
      const oldest = Math.min(...this.blocks.keys());
      const oldVisual = this.blocks.get(oldest);
      if (oldVisual) {
        this.world.removeBlockEntity(oldVisual);
      }
      this.blocks.delete(oldest);
    }
    
    // Update block count display
    if (this.blockCountElement) {
      this.blockCountElement.textContent = this.blocks.size.toString();
    }
  }

  addTransaction(tx: Transaction): void {
    const visual = new TransactionVisual(tx, this.world);
    this.pendingTransactions.push(visual);
    this.world.addTransactionEntity(visual);
    
    // Update transaction count
    if (this.txCountElement) {
      const current = parseInt(this.txCountElement.textContent || '0');
      this.txCountElement.textContent = (current + 1).toString();
    }
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    this.world.destroy();
  }

  private loop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.time += dt;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // Update pixel world physics
    this.world.update(dt);
    
    // Update block visuals
    for (const block of this.blocks.values()) {
      block.update(dt);
    }
    
    // Update transaction visuals
    for (const tx of this.pendingTransactions) {
      tx.update(dt);
    }
    
    // Remove completed transactions
    this.pendingTransactions = this.pendingTransactions.filter(tx => !tx.isComplete());
    
    // Add ambient particles periodically for crowded feel
    this.ambientParticleTimer += dt;
    if (this.ambientParticleTimer > 0.5) {
      this.ambientParticleTimer = 0;
      this.addAmbientParticles();
    }
    
    // Update FPS display
    if (this.fpsElement) {
      this.fpsElement.textContent = this.world.getFps().toString();
    }
    if (this.resolutionElement) {
      const res = this.world.getResolution();
      this.resolutionElement.textContent = `${res.width}x${res.height}`;
    }
  }

  private addAmbientParticles(): void {
    const w = this.world['width'];
    const h = this.world['height'];
    
    // Add ambient particles at edges for continuous activity
    for (let i = 0; i < 10; i++) {
      const edge = Math.floor(Math.random() * 4);
      let x, y;
      
      switch (edge) {
        case 0: // Top
          x = Math.random() * w;
          y = 0;
          break;
        case 1: // Right
          x = w;
          y = Math.random() * h;
          break;
        case 2: // Bottom
          x = Math.random() * w;
          y = h;
          break;
        default: // Left
          x = 0;
          y = Math.random() * h;
      }
      
      const types = [PixelType.DUST, PixelType.EMBER, PixelType.SPARK];
      const type = types[Math.floor(Math.random() * types.length)];
      this.world.setPixel(x, y, type);
    }
  }

  private render(): void {
    const rect = this.canvas.getBoundingClientRect();
    
    // Dark space background with subtle gradient
    const bgGradient = this.ctx.createRadialGradient(
      rect.width / 2, rect.height / 2, 0,
      rect.width / 2, rect.height / 2, Math.max(rect.width, rect.height)
    );
    bgGradient.addColorStop(0, '#0f0f18');
    bgGradient.addColorStop(0.5, '#0a0a12');
    bgGradient.addColorStop(1, '#050508');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Render pixel world
    this.world.render(this.ctx);
    
    // Render block entities
    for (const block of this.blocks.values()) {
      block.render(this.ctx);
    }
    
    // Render transaction entities
    for (const tx of this.pendingTransactions) {
      tx.render(this.ctx);
    }
    
    // Render mouse glow effect
    this.renderMouseGlow();
  }

  private renderMouseGlow(): void {
    const gradient = this.ctx.createRadialGradient(
      this.mouseX, this.mouseY, 0,
      this.mouseX, this.mouseY, 150
    );
    gradient.addColorStop(0, 'rgba(96, 165, 250, 0.15)');
    gradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.05)');
    gradient.addColorStop(1, 'transparent');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Add subtle particle at mouse position occasionally
    if (Math.random() < 0.1) {
      this.world.setPixel(
        this.mouseX + (Math.random() - 0.5) * 100,
        this.mouseY + (Math.random() - 0.5) * 100,
        PixelType.ENERGY
      );
    }
  }
}