/**
 * Pixel World - Contains the pixel physics simulation
 * Noita-inspired visual effects with glow and particles
 */

import { PixelType, PIXEL_PROPERTIES } from './PixelTypes';

export class PixelWorld {
  private width: number;
  private height: number;
  private pixels: Uint8Array;
  private blockEntities: any[] = [];
  private transactionEntities: any[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private imageData: ImageData;
  private worker: Worker | null = null;
  private pendingPixels: Array<{ x: number; y: number; pixelType: PixelType }> = [];
  private pendingExplosions: Array<{ x: number; y: number; radius: number; intensity: number }> = [];
  private workerReady: boolean = false;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private fps: number = 0;
  private time: number = 0;

  constructor(width: number, height: number) {
    this.width = Math.floor(width);
    this.height = Math.floor(height);
    this.pixels = new Uint8Array(this.width * this.height);
    
    // Create offscreen canvas for pixel manipulation
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.imageData = this.ctx.createImageData(this.width, this.height);
    
    // Glow canvas for bloom effect
    this.glowCanvas = document.createElement('canvas');
    this.glowCanvas.width = this.width;
    this.glowCanvas.height = this.height;
    const glowCtx = this.glowCanvas.getContext('2d');
    if (!glowCtx) throw new Error('Could not get glow 2D context');
    this.glowCtx = glowCtx;
    
    this.initializeWorker();
    this.initialize();
  }

  private initializeWorker(): void {
    try {
      this.worker = new Worker(
        new URL('./PhysicsWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.worker.onmessage = (e) => {
        const msg = e.data;
        switch (msg.type) {
          case 'ready':
            this.workerReady = true;
            for (const p of this.pendingPixels) {
              this.worker?.postMessage({ type: 'setPixel', x: p.x, y: p.y, pixelType: p.pixelType });
            }
            this.pendingPixels = [];
            for (const exp of this.pendingExplosions) {
              this.worker?.postMessage({ type: 'explosion', ...exp });
            }
            this.pendingExplosions = [];
            break;
          case 'pixels':
            this.pixels = msg.data;
            break;
          case 'error':
            console.error('Physics worker error:', msg.message);
            break;
        }
      };
      
      this.worker.postMessage({ type: 'init', width: this.width, height: this.height });
    } catch (error) {
      console.warn('WebWorker not available, falling back to main thread:', error);
      this.worker = null;
      this.workerReady = true;
    }
  }

  private initialize(): void {
    this.pixels.fill(PixelType.EMPTY);
    this.addAmbientParticles();
  }

  private addAmbientParticles(): void {
    for (let i = 0; i < 500; i++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      const type = Math.random() > 0.85 ? PixelType.STAR : Math.random() > 0.7 ? PixelType.DUST : PixelType.EMBER;
      this.setPixel(x, y, type);
    }
  }

  resize(width: number, height: number): void {
    this.width = Math.floor(width);
    this.height = Math.floor(height);
    this.pixels = new Uint8Array(this.width * this.height);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.imageData = this.ctx.createImageData(this.width, this.height);
    this.glowCanvas.width = this.width;
    this.glowCanvas.height = this.height;
    
    if (this.worker && this.workerReady) {
      this.worker.postMessage({ type: 'resize', width: this.width, height: this.height });
    }
    
    this.initialize();
  }

  addBlockEntity(entity: any): void {
    this.blockEntities.push(entity);
  }

  removeBlockEntity(entity: any): void {
    const idx = this.blockEntities.indexOf(entity);
    if (idx > -1) this.blockEntities.splice(idx, 1);
  }

  addTransactionEntity(entity: any): void {
    this.transactionEntities.push(entity);
  }

  createExplosion(x: number, y: number, radius: number = 20, intensity: number = 1): void {
    if (this.worker && this.workerReady) {
      this.worker.postMessage({ type: 'explosion', x, y, radius, intensity });
    } else {
      this.pendingExplosions.push({ x, y, radius, intensity });
    }
  }

  update(dt: number): void {
    this.time += dt;
    
    // Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
    
    // Use worker for physics if available
    if (this.worker && this.workerReady) {
      this.worker.postMessage({ type: 'update', dt });
    }
    
    // Update entities
    for (const entity of this.blockEntities) {
      entity.update(dt);
    }
    for (const entity of this.transactionEntities) {
      entity.update(dt);
    }
  }

  private updatePhysicsMainThread(dt: number): void {
    // Simplified main thread physics fallback
    const gravity = 50 * dt;
    
    for (let y = this.height - 2; y >= 0; y--) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const pixelType = this.pixels[idx];
        
        if (pixelType === PixelType.EMPTY) continue;
        
        const props = PIXEL_PROPERTIES[pixelType as PixelType];
        if (!props) continue;
        
        if (props.gravity > 0) {
          const belowIdx = (y + 1) * this.width + x;
          if (y < this.height - 1 && this.canMove(pixelType, belowIdx)) {
            this.swapPixels(idx, belowIdx);
          }
        }
      }
    }
  }

  private canMove(fromType: PixelType, toIdx: number): boolean {
    if (toIdx < 0 || toIdx >= this.pixels.length) return false;
    const toType = this.pixels[toIdx];
    return toType === PixelType.EMPTY || toType === PixelType.DUST;
  }

  private swapPixels(idx1: number, idx2: number): void {
    const temp = this.pixels[idx1];
    this.pixels[idx1] = this.pixels[idx2];
    this.pixels[idx2] = temp;
  }

  setPixel(x: number, y: number, type: PixelType): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = Math.floor(y) * this.width + Math.floor(x);
    this.pixels[idx] = type;
    
    if (this.worker && this.workerReady) {
      this.worker.postMessage({ type: 'setPixel', x: Math.floor(x), y: Math.floor(y), pixelType: type });
    } else {
      this.pendingPixels.push({ x: Math.floor(x), y: Math.floor(y), pixelType: type });
    }
  }

  getPixel(x: number, y: number): PixelType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return PixelType.EMPTY;
    const idx = Math.floor(y) * this.width + Math.floor(x);
    return this.pixels[idx];
  }

  getFps(): number {
    return this.fps;
  }

  getResolution(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const data = this.imageData.data;
    const flickerTime = this.time * 10;
    
    // Clear to dark background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 10;
      data[i + 1] = 10;
      data[i + 2] = 15;
      data[i + 3] = 255;
    }
    
    // Render glow layer first (for bloom effect)
    this.glowCtx.clearRect(0, 0, this.width, this.height);
    
    // Update image data from pixels with enhanced glow
    for (let i = 0; i < this.pixels.length; i++) {
      const pixelType = this.pixels[i];
      const props = PIXEL_PROPERTIES[pixelType as PixelType];
      
      if (!props) continue;
      
      const offset = i * 4;
      let r = props.color[0];
      let g = props.color[1];
      let b = props.color[2];
      let a = props.color[3];
      
      // Apply flicker effect
      if (props.flickerRate > 0) {
        const flicker = 0.7 + 0.3 * Math.sin(flickerTime + i * 0.1);
        const variance = props.flickerRate * (1 - flicker);
        r = Math.min(255, Math.floor(r * (1 - variance) + r * variance * Math.random()));
        g = Math.min(255, Math.floor(g * (1 - variance) + g * variance * Math.random()));
        b = Math.min(255, Math.floor(b * (1 - variance) + b * variance * Math.random()));
      }
      
      // Enhance glow for emissive particles
      if (props.glow && props.glowIntensity > 0) {
        const glowBoost = props.glowIntensity * 0.5;
        r = Math.min(255, Math.floor(r + 255 * glowBoost));
        g = Math.min(255, Math.floor(g + 255 * glowBoost));
        b = Math.min(255, Math.floor(b + 255 * glowBoost));
        
        // Draw glow on glow canvas
        const x = i % this.width;
        const y = Math.floor(i / this.width);
        const glowRadius = Math.floor(3 + props.glowIntensity * 5);
        const gradient = this.glowCtx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, `rgba(${props.color[0]}, ${props.color[1]}, ${props.color[2]}, ${0.6 * props.glowIntensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.glowCtx.fillStyle = gradient;
        this.glowCtx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
      }
      
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
    
    this.ctx.putImageData(this.imageData, 0, 0);
    
    // Composite glow layer
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.drawImage(this.glowCanvas, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
    
    // Scale to match target canvas
    const rect = ctx.canvas.getBoundingClientRect();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, 0, 0, rect.width, rect.height);
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}