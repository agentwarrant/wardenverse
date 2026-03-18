/**
 * ScoreSystem - A dopamine-inducing scoring system inspired by 90s arcade games
 * Features: combos, multipliers, floating popups, screen shake, flash effects
 */

export interface ScorePopup {
  x: number;
  y: number;
  points: number;
  multiplier: number;
  startTime: number;
  duration: number;
  vy: number; // vertical velocity (floats up)
  scale: number;
  color: string;
  text: string;
}

export interface ComboState {
  count: number;
  lastHitTime: number;
  multiplier: number;
  comboWindow: number; // ms to maintaincombo
}

export interface ScoreEvent {
  points: number;
  x: number;
  y: number;
  type: 'block' | 'transaction' | 'token' | 'inference' | 'contract';
}

// Score values for different entity types
export const SCORE_VALUES = {
  block: 5,
  transaction: 10,
  token: 20,
  inference: 50,
  contract: 100,
};

// Combo thresholds and rewards
const COMBO_THRESHOLDS = [
  { hits: 3, multiplier: 1.5, name: 'COMBO!', color: '#fbbf24' },      // Yellow
  { hits: 5, multiplier: 2, name: 'NICE!', color: '#34d399' },         // Green  
  { hits: 10, multiplier: 3, name: 'GREAT!', color: '#60a5fa' },       // Blue
  { hits: 15, multiplier: 4, name: 'AWESOME!', color: '#a78bfa' },     // Purple
  { hits: 20, multiplier: 5, name: 'INCREDIBLE!', color: '#f472b6' },  // Pink
  { hits: 30, multiplier: 7, name: 'LEGENDARY!', color: '#fb923c' },   // Orange
  { hits: 50, multiplier: 10, name: 'GODLIKE!', color: '#ef4444' },    // Red
];

// Popup animation settings
const POPUP_DURATION = 1500; // ms
const POPUP_FLOAT_SPEED = -80; // pixels per second (negative = up)
const POPUP_INITIAL_SCALE = 1.5;

export class ScoreSystem {
  private score: number = 0;
  private highScore: number = 0;
  private combo: ComboState;
  private popups: ScorePopup[] = [];
  private screenShake: number = 0;
  private screenShakeIntensity: number = 0;
  private flashAlpha: number = 0;
  private flashColor: string = '#ffffff';
  private scoreElement: HTMLElement | null = null;
  private multiplierElement: HTMLElement | null = null;
  private comboTextElement: HTMLElement | null = null;
  private lastMultiplierLevel: number = -1;
  private onScreenShake: ((intensity: number) => void) | null = null;
  
  constructor() {
    this.combo = {
      count: 0,
      lastHitTime: 0,
      multiplier: 1,
      comboWindow: 2000, // 2 seconds to maintain combo
    };
  }

  /**
   * Set DOM elements for score display
   */
  setElements(scoreEl: HTMLElement | null, multiplierEl: HTMLElement | null, comboTextEl: HTMLElement | null): void {
    this.scoreElement = scoreEl;
    this.multiplierElement = multiplierEl;
    this.comboTextElement = comboTextEl;
  }

  /**
   * Set callback for screen shake
   */
  setOnScreenShake(callback: (intensity: number) => void): void {
    this.onScreenShake = callback;
  }

  /**
   * Reset score and combo (when entering laser mode)
   */
  reset(): void {
    this.score = 0;
    this.combo.count = 0;
    this.combo.lastHitTime = 0;
    this.combo.multiplier = 1;
    this.popups = [];
    this.screenShake = 0;
    this.flashAlpha = 0;
    this.lastMultiplierLevel = -1;
    this.updateDisplay();
  }

  /**
   * Get current score
   */
  getScore(): number {
    return this.score;
  }

  /**
   * Get high score
   */
  getHighScore(): number {
    return this.highScore;
  }

  /**
   * Add score with full dopamine effects
   */
  addScore(event: ScoreEvent): void {
    const now = Date.now();
    
    // Update combo
    if (now - this.combo.lastHitTime < this.combo.comboWindow) {
      this.combo.count++;
      this.combo.lastHitTime = now;
      
      // Find current multiplier level
      let currentLevel = -1;
      for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
        if (this.combo.count >= COMBO_THRESHOLDS[i].hits) {
          currentLevel = i;
          if (i > this.lastMultiplierLevel) {
            // Leveled up! Big celebration
            this.combo.multiplier = COMBO_THRESHOLDS[i].multiplier;
            this.triggerComboLevelUp(COMBO_THRESHOLDS[i]);
            this.lastMultiplierLevel = i;
          }
          break;
        }
      }
    } else {
      // Combo expired, reset
      this.combo.count = 1;
      this.combo.multiplier = 1;
      this.combo.lastHitTime = now;
      this.lastMultiplierLevel = -1;
    }

    // Calculate final points with multiplier
    const finalPoints = Math.floor(event.points * this.combo.multiplier);
    this.score += finalPoints;

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }

    // Create floating popup
    this.createPopup(event, finalPoints);

    // Trigger screen effects based on score
    this.triggerEffects(event.type, finalPoints);

    // Update display
    this.updateDisplay();
  }

  /**
   * Create a floating score popup
   */
  private createPopup(event: ScoreEvent, points: number): void {
    const threshold = this.getThresholdForCombo(this.combo.count);
    
    this.popups.push({
      x: event.x,
      y: event.y,
      points,
      multiplier: this.combo.multiplier,
      startTime: Date.now(),
      duration: POPUP_DURATION,
      vy: POPUP_FLOAT_SPEED,
      scale: POPUP_INITIAL_SCALE,
      color: threshold?.color || this.getColorForType(event.type),
      text: this.getPopupText(event.type, points, this.combo.multiplier),
    });
  }

  /**
   * Get color based on entity type
   */
  private getColorForType(type: string): string {
    switch (type) {
      case 'contract': return '#ef4444'; // Red - highest value
      case 'inference': return '#a855f7'; // Purple
      case 'token': return '#34d399'; // Green
      case 'transaction': return '#60a5fa'; // Blue
      default: return '#fbbf24'; // Yellow
    }
  }

  /**
   * Get popup text based on type and multiplier
   */
  private getPopupText(type: string, points: number, multiplier: number): string {
    if (multiplier >= 5) {
      return `+${points} x${multiplier.toFixed(1)}!`;
    } else if (multiplier > 1) {
      return `+${points}`;
    }
    return `+${points}`;
  }

  /**
   * Get threshold for combo count
   */
  private getThresholdForCombo(count: number): typeof COMBO_THRESHOLDS[0] | null {
    for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
      if (count >= COMBO_THRESHOLDS[i].hits) {
        return COMBO_THRESHOLDS[i];
      }
    }
    return null;
  }

  /**
   * Trigger effects when hitting a new combo level
   */
  private triggerComboLevelUp(threshold: typeof COMBO_THRESHOLDS[0]): void {
    // Big screen flash
    this.flashAlpha = 0.4;
    this.flashColor = threshold.color;
    
    // Big screen shake
    this.screenShake = 0.5;
    this.screenShakeIntensity = 15;
    
    // Update combo text
    if (this.comboTextElement) {
      this.comboTextElement.textContent = threshold.name;
      this.comboTextElement.style.color = threshold.color;
      this.comboTextElement.classList.add('combo-flash');
      setTimeout(() => {
        this.comboTextElement?.classList.remove('combo-flash');
      }, 500);
    }
  }

  /**
   * Trigger screen effects based on type and score
   */
  private triggerEffects(type: string, points: number): void {
    // Screen shake intensity based on points
    const shakeIntensity = Math.min(10, points / 10);
    this.screenShake = 0.2;
    this.screenShakeIntensity = shakeIntensity;
    
    // Small flash for big hits
    if (points >= 50) {
      this.flashAlpha = Math.min(0.3, points / 200);
      this.flashColor = this.getColorForType(type);
    }
  }

  /**
   * Update score display element
   */
  private updateDisplay(): void {
    if (this.scoreElement) {
      // Animate the score number
      this.scoreElement.textContent = this.score.toLocaleString();
      this.scoreElement.classList.add('score-bump');
      setTimeout(() => {
        this.scoreElement?.classList.remove('score-bump');
      }, 100);
    }
    
    if (this.multiplierElement) {
      if (this.combo.multiplier > 1) {
        this.multiplierElement.textContent = `x${this.combo.multiplier.toFixed(1)}`;
        this.multiplierElement.style.display = 'inline';
      } else {
        this.multiplierElement.style.display = 'none';
      }
    }
  }

  /**
   * Update combo state (call every frame)
   */
  update(dt: number): void {
    const now = Date.now();
    
    // Check if combo expired
    if (this.combo.count > 0 && now - this.combo.lastHitTime > this.combo.comboWindow) {
      this.combo.count = 0;
      this.combo.multiplier = 1;
      this.lastMultiplierLevel = -1;
      if (this.multiplierElement) {
        this.multiplierElement.style.display = 'none';
      }
      if (this.comboTextElement) {
        this.comboTextElement.textContent = '';
      }
    }
    
    // Update popups
    this.popups = this.popups.filter(popup => {
      const elapsed = now - popup.startTime;
      return elapsed < popup.duration;
    });
    
    // Decay flash
    this.flashAlpha *= 0.9;
    
    // Decay screen shake
    this.screenShake *= 0.85;
  }

  /**
   * Render score popups to canvas
   */
  render(ctx: CanvasRenderingContext2D): void {
    const now = Date.now();
    
    // Render popups
    for (const popup of this.popups) {
      const elapsed = now - popup.startTime;
      const progress = elapsed / popup.duration;
      
      // Calculate position (float up)
      const y = popup.y + popup.vy * (elapsed / 1000);
      
      // Fade out
      const alpha = 1 - progress;
      
      // Scale: start big, shrink to normal, then grow slightly at end
      let scale = popup.scale * (1 - progress * 0.5);
      
      // Render text with glow
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.floor(20 * scale)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Glow effect
      ctx.shadowColor = popup.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.x, y);
      
      // White outline for readability
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeText(popup.text, popup.x, y);
      ctx.fillText(popup.text, popup.x, y);
      
      ctx.restore();
    }
  }

  /**
   * Get screen shake offset for rendering
   */
  getScreenShake(): { x: number; y: number } {
    if (this.screenShake < 0.01) {
      return { x: 0, y: 0 };
    }
    
    const x = (Math.random() - 0.5) * this.screenShakeIntensity * this.screenShake;
    const y = (Math.random() - 0.5) * this.screenShakeIntensity * this.screenShake;
    
    return { x, y };
  }

  /**
   * Render flash overlay
   */
  renderFlash(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.flashAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  /**
   * Get current combo info for UI
   */
  getComboInfo(): { count: number; multiplier: number; timeLeft: number } {
    const timeLeft = Math.max(0, this.combo.comboWindow - (Date.now() - this.combo.lastHitTime));
    return {
      count: this.combo.count,
      multiplier: this.combo.multiplier,
      timeLeft,
    };
  }
}