/**
 * Core rendering engine with pixel physics simulation
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.world = new PixelWorld(800, 600); // Logical pixel resolution
    this.fpsElement = document.getElementById('fps');
    this.resolutionElement = document.getElementById('resolution');
    
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
    
    // Click to add particles
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Add a small explosion of particles
      for (let i = 0; i < 20; i++) {
        const px = x + (Math.random() - 0.5) * 30;
        const py = y + (Math.random() - 0.5) * 30;
        const types = [PixelType.FIRE, PixelType.GAS, PixelType.EXPLOSION, PixelType.ENERGY];
        const type = types[Math.floor(Math.random() * types.length)];
        this.world.setPixel(px, py, type);
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
  }

  addTransaction(tx: Transaction): void {
    const visual = new TransactionVisual(tx, this.world);
    this.pendingTransactions.push(visual);
    this.world.addTransactionEntity(visual);
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
    
    // Update FPS display
    if (this.fpsElement) {
      this.fpsElement.textContent = this.world.getFps().toString();
    }
    if (this.resolutionElement) {
      const res = this.world.getResolution();
      this.resolutionElement.textContent = `${res.width}x${res.height}`;
    }
  }

  private render(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.fillStyle = '#0a0a0f';
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
      this.mouseX, this.mouseY, 100
    );
    gradient.addColorStop(0, 'rgba(96, 165, 250, 0.1)');
    gradient.addColorStop(1, 'transparent');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}