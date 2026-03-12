/**
 * Pixel World - Contains the pixel physics simulation
 * Uses WebWorker for off-main-thread physics computation
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
  private imageData: ImageData;
  private worker: Worker | null = null;
  private pendingPixels: Array<{ x: number; y: number; pixelType: PixelType }> = [];
  private workerReady: boolean = false;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private fps: number = 0;
  private onUpdateComplete: (() => void) | null = null;

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
    
    this.initializeWorker();
    this.initialize();
  }

  private initializeWorker(): void {
    try {
      // Create worker from the compiled worker script
      this.worker = new Worker(
        new URL('./PhysicsWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.worker.onmessage = (e) => {
        const msg = e.data;
        switch (msg.type) {
          case 'ready':
            this.workerReady = true;
            // Process any pending pixel sets
            for (const p of this.pendingPixels) {
              this.worker?.postMessage({ type: 'setPixel', x: p.x, y: p.y, pixelType: p.pixelType });
            }
            this.pendingPixels = [];
            break;
          case 'pixels':
            this.pixels = msg.data;
            if (this.onUpdateComplete) {
              this.onUpdateComplete();
            }
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
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      const type = Math.random() > 0.7 ? PixelType.STAR : PixelType.DUST;
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

  update(dt: number): void {
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
    } else {
      // Fallback to main thread physics
      this.updatePhysicsMainThread(dt);
    }
    
    // Update entities (always on main thread for rendering)
    for (const entity of this.blockEntities) {
      entity.update(dt);
    }
    for (const entity of this.transactionEntities) {
      entity.update(dt);
    }
  }

  private updatePhysicsMainThread(dt: number): void {
    const gravity = 50 * dt;
    
    for (let y = this.height - 2; y >= 0; y--) {
      const randomStart = Math.random() > 0.5 ? 0 : 1;
      const startX = randomStart === 0 ? 0 : this.width - 1;
      const endX = randomStart === 0 ? this.width : -1;
      const step = randomStart === 0 ? 1 : -1;
      
      for (let x = startX; x !== endX; x += step) {
        const idx = y * this.width + x;
        const pixelType = this.pixels[idx];
        
        if (pixelType === PixelType.EMPTY) continue;
        
        const props = PIXEL_PROPERTIES[pixelType as PixelType];
        if (!props) continue;
        
        if (props.gravity > 0) {
          const belowIdx = (y + 1) * this.width + x;
          if (y < this.height - 1 && this.canMove(pixelType, belowIdx)) {
            this.swapPixels(idx, belowIdx);
          } else if (y < this.height - 1) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            const diagIdx = (y + 1) * this.width + (x + dir);
            if (x + dir >= 0 && x + dir < this.width && this.canMove(pixelType, diagIdx)) {
              this.swapPixels(idx, diagIdx);
            }
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
    // Update image data from pixels
    const data = this.imageData.data;
    for (let i = 0; i < this.pixels.length; i++) {
      const pixelType = this.pixels[i];
      const props = PIXEL_PROPERTIES[pixelType as PixelType];
      const offset = i * 4;
      
      if (props) {
        data[offset] = props.color[0];
        data[offset + 1] = props.color[1];
        data[offset + 2] = props.color[2];
        data[offset + 3] = props.color[3];
      } else {
        // Empty space - dark background
        data[offset] = 10;
        data[offset + 1] = 10;
        data[offset + 2] = 15;
        data[offset + 3] = 255;
      }
    }
    
    this.ctx.putImageData(this.imageData, 0, 0);
    
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