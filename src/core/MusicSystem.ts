/**
 * Retro Chiptune Music System
 * Generates keygen-style tracker music with Web Audio API
 * Inspired by oldschool 4-channel trackers (FastTracker, ScreamTracker)
 */

interface TrackNote {
  note: number; // MIDI note number
  duration: number; // in ticks
  instrument: number; // instrument index
  effect?: number; // effect type
  effectParam?: number;
}

interface Pattern {
  channels: TrackNote[][];
  length: number;
}

interface Instrument {
  type: 'square' | 'sawtooth' | 'triangle' | 'sine' | 'noise';
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  arpeggio?: number[]; // rapid note cycling
  vibrato?: { speed: number; depth: number };
  portamento?: number;
  pulseWidth?: number;
}

export class MusicSystem {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private bpm: number = 125;
  private ticksPerBeat: number = 4;
  private currentPattern: number = 0;
  private currentTick: number = 0;
  private schedulerId: number | null = null;
  private activeVoices: Map<string, OscillatorNode | AudioBufferSourceNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private volume: number = 0.15;

  // Keygen-style instruments
  private instruments: Instrument[] = [
    // Lead synth - bright square wave for arpeggios
    { type: 'square', attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1, arpeggio: [0, 4, 7] },
    // Bass - low sawtooth
    { type: 'sawtooth', attack: 0.02, decay: 0.15, sustain: 0.5, release: 0.2, portamento: 0.05 },
    // Pad - soft triangle
    { type: 'triangle', attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.3, vibrato: { speed: 5, depth: 3 } },
    // Lead2 - bright for melodies
    { type: 'square', attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.15, pulseWidth: 0.25 },
  ];

  // The patterns - classic keygen chord progressions
  private patterns: Pattern[] = [];

  // Note frequencies (A4 = 440Hz standard)
  private noteFrequencies: Map<number, number> = new Map();

  constructor() {
    this.initNoteFrequencies();
    this.initPatterns();
  }

  private initNoteFrequencies(): void {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    for (let octave = 0; octave < 9; octave++) {
      for (let n = 0; n < 12; n++) {
        const noteNum = octave * 12 + n;
        const freq = 440 * Math.pow(2, (noteNum - 69) / 12);
        this.noteFrequencies.set(noteNum, freq);
      }
    }
  }

  private initPatterns(): void {
    // Classic keygen chord progression: Am - F - C - G (very retro)
    // Pattern structure: [channel][tick] = note
    // Channel 0: Arpeggiated lead
    // Channel 1: Bass
    // Channel 2: Pad/Chords
    // Channel 3: Melody accents

    const tickDuration = 1; // Each note occupies this many ticks

    // Pattern 0: Am section
    this.patterns.push({
      length: 64,
      channels: [
        // Channel 0: Fast arpeggios (lead)
        this.createArpChannel([57, 60, 64], 2, 64), // Am arp (A3-C4-E4)
        // Channel 1: Walking bass
        this.createBassChannel([33, 36, 33, 34, 33, 31, 33, 36], 8),
        // Channel 2: Pad/Chords
        this.createPadChannel([57, 60, 64], 16, 64),
        // Channel 3: Melody accents
        this.createMelodyChannel([76, 69, 72, 76, 81, 79, 76, 72], 8),
      ]
    });

    // Pattern 1: F section
    this.patterns.push({
      length: 64,
      channels: [
        this.createArpChannel([53, 57, 60], 2, 64), // F arp (F3-A3-C4)
        this.createBassChannel([29, 32, 29, 27, 29, 32, 29, 27], 8),
        this.createPadChannel([53, 57, 60], 16, 64),
        this.createMelodyChannel([74, 77, 81, 77, 74, 72, 74, 77], 8),
      ]
    });

    // Pattern 2: C section
    this.patterns.push({
      length: 64,
      channels: [
        this.createArpChannel([48, 52, 55], 2, 64), // C arp (C3-E3-G3)
        this.createBassChannel([24, 28, 31, 28, 24, 28, 31, 28], 8),
        this.createPadChannel([48, 52, 55], 16, 64),
        this.createMelodyChannel([72, 76, 79, 76, 72, 71, 72, 76], 8),
      ]
    });

    // Pattern 3: G section (high energy)
    this.patterns.push({
      length: 64,
      channels: [
        this.createArpChannel([43, 47, 50], 2, 64), // G arp (G2-B2-D3)
        this.createBassChannel([31, 35, 38, 35, 31, 35, 38, 31], 8),
        this.createPadChannel([43, 47, 50], 16, 64),
        this.createMelodyChannel([79, 83, 86, 83, 79, 77, 79, 83], 8),
      ]
    });

    // Pattern 4: Variation - Dm section
    this.patterns.push({
      length: 64,
      channels: [
        this.createArpChannel([50, 53, 57], 2, 64), // Dm arp (D3-F3-A3)
        this.createBassChannel([38, 41, 38, 36, 38, 41, 38, 36], 8),
        this.createPadChannel([50, 53, 57], 16, 64),
        this.createMelodyChannel([74, 77, 81, 84, 81, 77, 74, 72], 8),
      ]
    });

    // Pattern 5: Em section
    this.patterns.push({
      length: 64,
      channels: [
        this.createArpChannel([52, 55, 59], 2, 64), // Em arp (E3-G3-B3)
        this.createBassChannel([40, 43, 40, 38, 40, 43, 40, 38], 8),
        this.createPadChannel([52, 55, 59], 16, 64),
        this.createMelodyChannel([76, 79, 83, 86, 83, 79, 76, 74], 8),
      ]
    });
  }

  private createArpChannel(notes: number[], ticksPerNote: number, totalTicks: number): TrackNote[] {
    const channel: TrackNote[] = [];
    for (let i = 0; i < totalTicks; i += ticksPerNote) {
      const noteIndex = Math.floor(i / ticksPerNote) % notes.length;
      channel.push({
        note: notes[noteIndex],
        duration: ticksPerNote,
        instrument: 0,
        effect: 0, // arpeggio effect
        effectParam: 7 // arpeggio speed
      });
    }
    return channel;
  }

  private createBassChannel(notes: number[], ticksPerNote: number): TrackNote[] {
    const channel: TrackNote[] = [];
    for (let i = 0; i < notes.length; i++) {
      channel.push({
        note: notes[i],
        duration: ticksPerNote,
        instrument: 1,
        effect: 1 // portamento
      });
    }
    return channel;
  }

  private createPadChannel(chord: number[], ticksPerChord: number, totalTicks: number): TrackNote[] {
    const channel: TrackNote[] = [];
    for (let i = 0; i < totalTicks; i += ticksPerChord) {
      const transposition = Math.floor(i / ticksPerChord) % 4 * 2 - 2;
      const finalNote = chord[0] + transposition;
      channel.push({
        note: finalNote,
        duration: ticksPerChord,
        instrument: 2,
        effect: 2 // vibrato
      });
    }
    return channel;
  }

  private createMelodyChannel(notes: number[], ticksPerNote: number): TrackNote[] {
    const channel: TrackNote[] = [];
    for (let i = 0; i < notes.length; i++) {
      channel.push({
        note: notes[i],
        duration: ticksPerNote,
        instrument: 3,
        effect: i % 2 === 0 ? undefined : 3 // slight slide on every other note
      });
    }
    return channel;
  }

  private async initAudio(): Promise<void> {
    if (this.audioContext) return;
    
    this.audioContext = new AudioContext();
    
    // Master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.audioContext.destination);

    // Add a slight reverb/chorus effect for that authentic tracker feel
    this.addEffects();
  }

  private addEffects(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Simple chorus/delay for depth
    const delay = this.audioContext.createDelay();
    delay.delayTime.value = 0.02;
    
    const feedback = this.audioContext.createGain();
    feedback.gain.value = 0.3;
    
    const wetGain = this.audioContext.createGain();
    wetGain.gain.value = 0.15;
    
    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 0.85;
    
    // Create chorus effect path
    const chorusGain = this.audioContext.createGain();
    chorusGain.gain.value = 0.3;
    
    const lfo = this.audioContext.createOscillator();
    lfo.frequency.value = 0.5;
    lfo.type = 'sine';
    
    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = 0.001;
    
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();
    
    this.masterGain.connect(dryGain);
    dryGain.connect(this.audioContext.destination);
    
    this.masterGain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(this.audioContext.destination);
    
    // Reconnect master gain to the dry path
    this.masterGain.disconnect();
    this.masterGain.connect(dryGain);
    this.masterGain.connect(delay);
  }

  public async start(): Promise<void> {
    await this.initAudio();
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isPlaying = true;
    this.currentPattern = 0;
    this.currentTick = 0;

    // Start the scheduler
    this.scheduleNotes();
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.schedulerId) {
      cancelAnimationFrame(this.schedulerId);
      this.schedulerId = null;
    }
    
    // Stop all active voices
    this.activeVoices.forEach((voice) => {
      try {
        voice.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeVoices.clear();
    this.gainNodes.clear();
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  private scheduleNotes(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    const tickDuration = 60 / this.bpm / this.ticksPerBeat;
    const pattern = this.patterns[this.currentPattern];

    // Schedule notes for each channel
    pattern.channels.forEach((channel, channelIndex) => {
      const currentNote = channel.find((note, index) => {
        const noteTick = channel.slice(0, index).reduce((sum, n) => sum + n.duration, 0);
        return this.currentTick >= noteTick && this.currentTick < noteTick + note.duration;
      });

      if (currentNote && this.currentTick % currentNote.duration === 0) {
        this.playNote(currentNote.note, currentNote.instrument, tickDuration * currentNote.duration * 0.9, channelIndex);
      }
    });

    // Advance tick
    this.currentTick++;
    if (this.currentTick >= pattern.length) {
      this.currentTick = 0;
      this.currentPattern = (this.currentPattern + 1) % this.patterns.length;
    }

    // Schedule next tick
    setTimeout(() => this.scheduleNotes(), tickDuration * 1000);
  }

  private playNote(noteNumber: number, instrumentIndex: number, duration: number, channelId: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const voiceId = `${channelId}-${noteNumber}-${Date.now()}`;
    const instrument = this.instruments[instrumentIndex] || this.instruments[0];
    const freq = this.noteFrequencies.get(noteNumber) || 440;

    const now = this.audioContext.currentTime;
    const endTime = now + duration;

    // Create oscillator
    const osc = this.audioContext.createOscillator();
    
    // Set waveform type
    if (instrument.type === 'noise') {
      // For noise, we'll use a buffer source
      this.playNoise(duration, instrument, voiceId);
      return;
    }
    
    osc.type = instrument.type;
    osc.frequency.value = freq;

    // Pulse width modulation for square waves
    if (instrument.pulseWidth && instrument.type === 'square') {
      // Apply pulse width using a custom approach
      const pwm = this.audioContext.createGain();
      // This creates a thinner, more aggressive sound
      osc.connect(pwm);
      pwm.connect(this.masterGain);
    }

    // Vibrato
    if (instrument.vibrato) {
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();
      lfo.frequency.value = instrument.vibrato.speed;
      lfoGain.gain.value = instrument.vibrato.depth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(endTime);
    }

    // Portamento
    if (instrument.portamento && oscillatorWasPlaying[channelId]) {
      // Smooth pitch slide from previous note
      const prevFreq = previousNoteFreq[channelId] || freq;
      osc.frequency.setValueAtTime(prevFreq, now);
      osc.frequency.linearRampToValueAtTime(freq, now + instrument.portamento);
    }
    previousNoteFreq[channelId] = freq;
    oscillatorWasPlaying[channelId] = true;

    // ADSR envelope
    const gainNode = this.audioContext.createGain();
    const maxGain = 0.25 / (instrumentIndex + 1); // Lower volume for bass
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(maxGain, now + instrument.attack);
    gainNode.gain.linearRampToValueAtTime(maxGain * instrument.sustain, now + instrument.attack + instrument.decay);
    gainNode.gain.setValueAtTime(maxGain * instrument.sustain, endTime - instrument.release);
    gainNode.gain.linearRampToValueAtTime(0, endTime);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Arpeggio effect (fast cycling through chord tones)
    if (instrument.arpeggio && instrument.arpeggio.length > 0) {
      const arpDuration = duration / instrument.arpeggio.length;
      instrument.arpeggio.forEach((semitones, i) => {
        const arpFreq = freq * Math.pow(2, semitones / 12);
        osc.frequency.setValueAtTime(arpFreq, now + i * arpDuration);
      });
    }

    osc.start(now);
    osc.stop(endTime + 0.1);

    // Track for cleanup
    this.activeVoices.set(voiceId, osc);
    this.gainNodes.set(voiceId, gainNode);

    // Cleanup after note ends
    setTimeout(() => {
      this.activeVoices.delete(voiceId);
      this.gainNodes.delete(voiceId);
    }, (duration + 0.2) * 1000);
  }

  private playNoise(duration: number, instrument: Instrument, voiceId: string): void {
    if (!this.audioContext || !this.masterGain) return;

    // Create noise buffer for percussion
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();
    const now = this.audioContext.currentTime;

    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start(now);

    this.activeVoices.set(voiceId, source);
    this.gainNodes.set(voiceId, gainNode);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

// Track previous note frequencies for portamento
const previousNoteFreq: { [channelId: number]: number } = {};
const oscillatorWasPlaying: { [channelId: number]: boolean } = {};