/**
 * Reactive Music System for Wardenverse
 * House-style rhythm with synth sounds triggered by blockchain events
 * No continuous melody - sounds emerge from on-chain activity
 */

export type TransactionType = 'transfer' | 'contract' | 'token' | 'inference';

interface DrumSound {
  type: 'kick' | 'snare' | 'hihat' | 'clap';
  gain: number;
  decay: number;
  pitch?: number;
}

interface SynthSound {
  frequency: number;
  type: OscillatorType;
  gain: number;
  attack: number;
  decay: number;
  release: number;
  filterFreq?: number;
}

export class MusicSystem {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rhythmGain: GainNode | null = null;
  private synthGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private bpm: number = 120; // House tempo
  private schedulerId: ReturnType<typeof setTimeout> | null = null;
  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  
  // Volume settings
  private rhythmVolume: number = 0.3;
  private synthVolume: number = 0.08; // Lower volume for synth notes
  
  // House rhythm pattern (16 steps per bar)
  private readonly KICK_PATTERN = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // Four-on-the-floor
  private readonly HIHAT_PATTERN = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // Continuous hi-hats
  private readonly CLAP_PATTERN = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]; // Claps on 2 and 4
  
  // Synth note pool for blockchain events (pentatonic scale - always sounds harmonious)
  private readonly BLOCK_NOTES = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4 pentatonic
  private readonly TRANSFER_NOTES = [523.25, 587.33, 659.25]; // C5 pentatonic (higher)
  private readonly CONTRACT_NOTES = [130.81, 146.83, 164.81]; // C3 (bass, lower)
  private readonly TOKEN_NOTES = [392.00, 440.00, 493.88]; // Mid range
  private readonly INFERENCE_NOTES = [196.00, 220.00, 246.94]; // G3-Bb3 (mysterious)

  constructor() {}

  private async initAudio(): Promise<void> {
    if (this.audioContext) return;
    
    this.audioContext = new AudioContext();
    
    // Master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.audioContext.destination);
    
    // Separate gain nodes for rhythm and synth
    this.rhythmGain = this.audioContext.createGain();
    this.rhythmGain.gain.value = this.rhythmVolume;
    this.rhythmGain.connect(this.masterGain);
    
    this.synthGain = this.audioContext.createGain();
    this.synthGain.gain.value = this.synthVolume;
    this.synthGain.connect(this.masterGain);
    
    // Add subtle reverb for depth
    this.addReverb();
  }

  private addReverb(): void {
    if (!this.audioContext || !this.masterGain) return;
    
    // Simple convolution-style reverb using delay
    const delay1 = this.audioContext.createDelay();
    const delay2 = this.audioContext.createDelay();
    const feedback1 = this.audioContext.createGain();
    const feedback2 = this.audioContext.createGain();
    const wetGain = this.audioContext.createGain();
    
    delay1.delayTime.value = 0.1;
    delay2.delayTime.value = 0.15;
    feedback1.gain.value = 0.2;
    feedback2.gain.value = 0.15;
    wetGain.gain.value = 0.15;
    
    // Create reverb tail
    this.masterGain.connect(delay1);
    delay1.connect(feedback1);
    feedback1.connect(delay1);
    delay1.connect(delay2);
    delay2.connect(feedback2);
    feedback2.connect(delay2);
    delay2.connect(wetGain);
    wetGain.connect(this.audioContext.destination);
  }

  public async start(): Promise<void> {
    await this.initAudio();
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.audioContext.currentTime;
    this.scheduleRhythm();
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.schedulerId) {
      clearTimeout(this.schedulerId);
      this.schedulerId = null;
    }
  }

  public setRhythmVolume(volume: number): void {
    this.rhythmVolume = Math.max(0, Math.min(1, volume));
    if (this.rhythmGain) {
      this.rhythmGain.gain.value = this.rhythmVolume;
    }
  }

  public setSynthVolume(volume: number): void {
    this.synthVolume = Math.max(0, Math.min(1, volume));
    if (this.synthGain) {
      this.synthGain.gain.value = this.synthVolume;
    }
  }

  private scheduleRhythm(): void {
    if (!this.isPlaying || !this.audioContext) return;
    
    const secondsPerBeat = 60 / this.bpm;
    const secondsPerStep = secondsPerBeat / 4; // 16th notes
    
    // Schedule notes ahead of time
    while (this.nextNoteTime < this.audioContext.currentTime + 0.1) {
      // Kick drum
      if (this.KICK_PATTERN[this.currentStep]) {
        this.playKick(this.nextNoteTime);
      }
      
      // Hi-hat
      if (this.HIHAT_PATTERN[this.currentStep]) {
        this.playHihat(this.nextNoteTime);
      }
      
      // Clap
      if (this.CLAP_PATTERN[this.currentStep]) {
        this.playClap(this.nextNoteTime);
      }
      
      this.currentStep = (this.currentStep + 1) % 16;
      this.nextNoteTime += secondsPerStep;
    }
    
    // Continue scheduling
    this.schedulerId = setTimeout(() => this.scheduleRhythm(), 25);
  }

  private playKick(time: number): void {
    if (!this.audioContext || !this.rhythmGain) return;
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    // Pitch envelope for that house kick sound
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    
    // Amplitude envelope
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
    
    osc.connect(gain);
    gain.connect(this.rhythmGain);
    
    osc.start(time);
    osc.stop(time + 0.3);
  }

  private playHihat(time: number): void {
    if (!this.audioContext || !this.rhythmGain) return;
    
    // Use noise for hi-hat
    const bufferSize = this.audioContext.sampleRate * 0.05;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.rhythmGain);
    
    noise.start(time);
    noise.stop(time + 0.05);
  }

  private playClap(time: number): void {
    if (!this.audioContext || !this.rhythmGain) return;
    
    // Clap is made of multiple noise bursts
    const clapGain = this.audioContext.createGain();
    clapGain.gain.setValueAtTime(0.8, time);
    clapGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    clapGain.connect(this.rhythmGain);
    
    // Three noise bursts for clap effect
    for (let i = 0; i < 3; i++) {
      const bufferSize = this.audioContext.sampleRate * 0.02;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let j = 0; j < bufferSize; j++) {
        data[j] = Math.random() * 2 - 1;
      }
      
      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2000;
      filter.Q.value = 1;
      
      noise.connect(filter);
      filter.connect(clapGain);
      
      noise.start(time + i * 0.01);
      noise.stop(time + i * 0.01 + 0.02);
    }
  }

  /**
   * Play a synth sound triggered by a blockchain event
   * Called externally when blocks/transactions are detected
   */
  public playBlockSound(): void {
    if (!this.isPlaying || !this.audioContext || !this.synthGain) return;
    
    const freq = this.BLOCK_NOTES[Math.floor(Math.random() * this.BLOCK_NOTES.length)];
    this.playSynth({
      frequency: freq,
      type: 'sine',
      gain: 0.5,
      attack: 0.02,
      decay: 0.3,
      release: 0.2,
      filterFreq: 1200
    });
  }

  public playTransactionSound(type: TransactionType): void {
    if (!this.isPlaying || !this.audioContext || !this.synthGain) return;
    
    let notes: number[];
    let oscType: OscillatorType;
    let decay: number;
    
    switch (type) {
      case 'transfer':
        notes = this.TRANSFER_NOTES;
        oscType = 'sine';
        decay = 0.15;
        break;
      case 'contract':
        notes = this.CONTRACT_NOTES;
        oscType = 'sawtooth';
        decay = 0.4;
        break;
      case 'token':
        notes = this.TOKEN_NOTES;
        oscType = 'triangle';
        decay = 0.25;
        break;
      case 'inference':
        notes = this.INFERENCE_NOTES;
        oscType = 'square';
        decay = 0.5;
        break;
      default:
        notes = this.TRANSFER_NOTES;
        oscType = 'sine';
        decay = 0.2;
    }
    
    const freq = notes[Math.floor(Math.random() * notes.length)];
    
    this.playSynth({
      frequency: freq,
      type: oscType,
      gain: 0.3,
      attack: 0.01,
      decay,
      release: 0.1,
      filterFreq: type === 'inference' ? 800 : 2000
    });
  }

  private playSynth(config: SynthSound): void {
    if (!this.audioContext || !this.synthGain) return;
    
    const now = this.audioContext.currentTime;
    
    // Create oscillator
    const osc = this.audioContext.createOscillator();
    osc.type = config.type;
    osc.frequency.value = config.frequency;
    
    // Add slight detune for richness
    const osc2 = this.audioContext.createOscillator();
    osc2.type = config.type;
    osc2.frequency.value = config.frequency * 1.002; // Slight detune
    
    // Filter for tone shaping
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = config.filterFreq || 2000;
    filter.Q.value = 1;
    
    // Envelope
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(config.gain, now + config.attack);
    gain.gain.exponentialRampToValueAtTime(config.gain * 0.3, now + config.attack + config.decay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + config.attack + config.decay + config.release);
    
    // Connect
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthGain);
    
    // Play
    osc.start(now);
    osc2.start(now);
    osc.stop(now + config.attack + config.decay + config.release + 0.1);
    osc2.stop(now + config.attack + config.decay + config.release + 0.1);
  }

  /**
   * Play a "big" sound for significant events (new block with multiple txs, etc.)
   */
  public playBigEventSound(): void {
    if (!this.isPlaying || !this.audioContext || !this.synthGain) return;
    
    // Play a chord with longer decay
    const chord = [261.63, 329.63, 392.00]; // C major chord
    
    chord.forEach((freq, i) => {
      setTimeout(() => {
        this.playSynth({
          frequency: freq,
          type: 'sine',
          gain: 0.4,
          attack: 0.05,
          decay: 0.5,
          release: 0.3,
          filterFreq: 1500
        });
      }, i * 30);
    });
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}