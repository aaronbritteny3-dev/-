import { Player } from '../types';

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;
  private tensionOscillator: OscillatorNode | null = null;
  private tensionGain: GainNode | null = null;
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;

  constructor() {
    // Lazy init to handle browser autoplay policies
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5; // Master volume
      this.masterGain.connect(this.ctx.destination);
    }
  }

  public async resume() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Toggle global mute by suspending the context
  public toggleMute(): boolean {
    if (!this.ctx) {
        this.init();
        return false;
    }
    if (this.ctx.state === 'running') {
        this.ctx.suspend();
        return true; // Muted
    } else {
        this.ctx.resume();
        return false; // Active
    }
  }

  public isMuted(): boolean {
      return this.ctx ? this.ctx.state === 'suspended' : false;
  }

  // Load BGM from URL
  private async loadBGM(url: string): Promise<AudioBuffer> {
    this.init();
    if (!this.ctx) throw new Error('AudioContext not initialized');

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  }

  // --- BGM: New Ambient Synth ---  
  public startBGM() {
    this.init();
    this.stopBGM();

    if (!this.ctx || !this.masterGain) return;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.2; // Lower volume for ambient feel
    this.bgmGain.connect(this.masterGain);

    // Layer 1: Warm Pad (Main Atmosphere)
    const padOsc1 = this.ctx.createOscillator();
    padOsc1.type = 'sine';
    padOsc1.frequency.value = 110; // A2

    const padOsc2 = this.ctx.createOscillator();
    padOsc2.type = 'sine';
    padOsc2.frequency.value = 164.81; // E3

    const padOsc3 = this.ctx.createOscillator();
    padOsc3.type = 'sine';
    padOsc3.frequency.value = 220; // A3

    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.Q.value = 0.8;
    padFilter.frequency.value = 1200;

    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.25;

    // Pad LFO for gentle movement
    const padLFO = this.ctx.createOscillator();
    padLFO.type = 'sine';
    padLFO.frequency.value = 0.08; // 12.5 seconds per cycle

    const padLFAGain = this.ctx.createGain();
    padLFAGain.gain.value = 300;

    padLFO.connect(padLFAGain);
    padLFAGain.connect(padFilter.frequency);
    padLFO.start();
    this.bgmOscillators.push(padLFO);

    padOsc1.connect(padFilter);
    padOsc2.connect(padFilter);
    padOsc3.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.bgmGain);
    padOsc1.start();
    padOsc2.start();
    padOsc3.start();
    this.bgmOscillators.push(padOsc1, padOsc2, padOsc3);

    // Layer 2: Melodic Arpeggio (New Catchy Melody)
    const arpOsc = this.ctx.createOscillator();
    arpOsc.type = 'triangle';
    arpOsc.frequency.value = 261.63; // C4

    const arpFilter = this.ctx.createBiquadFilter();
    arpFilter.type = 'lowpass';
    arpFilter.Q.value = 0.9;
    arpFilter.frequency.value = 1800;

    const arpGain = this.ctx.createGain();
    arpGain.gain.value = 0.15;

    // New catchy arpeggio pattern
    const arpPatterns = [
      [261.63, 329.63, 392.00, 329.63], // C4, E4, G4, E4 (happy triad)
      [220, 293.66, 349.23, 293.66], // A3, D4, F4, D4 (warm triad)
      [293.66, 349.23, 440.00, 349.23], // D4, F4, A4, F4 (bright triad)
      [196.00, 261.63, 329.63, 261.63]  // G3, C4, E4, C4 (gentle triad)
    ];
    let arpPatternIndex = 0;
    let arpNoteIndex = 0;
    const arpInterval = setInterval(() => {
      if (arpOsc.context.state === 'running') {
        const currentPattern = arpPatterns[arpPatternIndex];
        arpOsc.frequency.setValueAtTime(currentPattern[arpNoteIndex], arpOsc.context.currentTime);
        arpNoteIndex = (arpNoteIndex + 1) % currentPattern.length;
        if (arpNoteIndex === 0) {
          arpPatternIndex = (arpPatternIndex + 1) % arpPatterns.length;
        }
      } else {
        clearInterval(arpInterval);
      }
    }, 300); // Arpeggio speed

    arpOsc.connect(arpFilter);
    arpFilter.connect(arpGain);
    arpGain.connect(this.bgmGain);
    arpOsc.start();
    this.bgmOscillators.push(arpOsc);

    // Layer 3: Subtle Bell Sound (Accent)
    const bellOsc = this.ctx.createOscillator();
    bellOsc.type = 'sine';
    bellOsc.frequency.value = 523.25; // C5

    const bellFilter = this.ctx.createBiquadFilter();
    bellFilter.type = 'bandpass';
    bellFilter.Q.value = 2;
    bellFilter.frequency.value = 2000;

    const bellGain = this.ctx.createGain();
    bellGain.gain.value = 0.08;

    // Bell pattern - occasional accents
    const bellPattern = [523.25, 659.25, 783.99, 659.25]; // C5, E5, G5, E5
    let bellIndex = 0;
    const bellInterval = setInterval(() => {
      if (bellOsc.context.state === 'running') {
        bellOsc.frequency.setValueAtTime(bellPattern[bellIndex], bellOsc.context.currentTime);
        bellIndex = (bellIndex + 1) % bellPattern.length;
      } else {
        clearInterval(bellInterval);
      }
    }, 2000); // Slow bell accents

    bellOsc.connect(bellFilter);
    bellFilter.connect(bellGain);
    bellGain.connect(this.bgmGain);
    bellOsc.start();
    this.bgmOscillators.push(bellOsc);
  }

  public setTension(active: boolean) {
    if (!this.ctx || !this.masterGain) return;

    if (active && !this.tensionOscillator) {
      // Add a faster pulsing bass for Phase 2b
      this.tensionGain = this.ctx.createGain();
      this.tensionGain.gain.value = 0;
      this.tensionGain.connect(this.masterGain);

      this.tensionOscillator = this.ctx.createOscillator();
      this.tensionOscillator.type = 'square';
      this.tensionOscillator.frequency.value = 40; // Deep sub bass
      this.tensionOscillator.start();
      this.tensionOscillator.connect(this.tensionGain);

      // LFO for pulsing effect
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 8; // 8Hz pulse
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(this.tensionGain.gain);
      lfo.start();
      
      // Fade in
      this.tensionGain.gain.setTargetAtTime(0.1, this.ctx.currentTime, 1);
    } else if (!active && this.tensionOscillator) {
        // Fade out
        if (this.tensionGain) {
            this.tensionGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        }
        setTimeout(() => {
            this.tensionOscillator?.stop();
            this.tensionOscillator = null;
        }, 600);
    }
  }

  public stopBGM() {
    this.bgmOscillators.forEach(o => o.stop());
    this.bgmOscillators = [];
    if (this.bgmSource) {
      this.bgmSource.stop();
      this.bgmSource = null;
    }
    if (this.tensionOscillator) {
        this.tensionOscillator.stop();
        this.tensionOscillator = null;
    }
  }

  // --- SFX ---

  public playHover() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playMove(player: Player) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    if (player === Player.Black) {
      // --- Heavy Mechanical Impact ---
      
      // 1. The Thud (Kick Drum style)
      // Low sine sweep for body
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(80, t);
      kickOsc.frequency.exponentialRampToValueAtTime(10, t + 0.3);
      kickGain.gain.setValueAtTime(1.0, t);
      kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      kickOsc.connect(kickGain);
      kickGain.connect(this.masterGain);
      kickOsc.start();
      kickOsc.stop(t + 0.3);

      // 2. The Clack (Metallic impact)
      // Square wave with lowpass filter
      const clackOsc = this.ctx.createOscillator();
      const clackGain = this.ctx.createGain();
      const clackFilter = this.ctx.createBiquadFilter();
      
      clackOsc.type = 'square';
      clackOsc.frequency.setValueAtTime(300, t);
      clackOsc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      
      clackFilter.type = 'lowpass';
      clackFilter.frequency.setValueAtTime(3000, t);
      clackFilter.frequency.linearRampToValueAtTime(1000, t + 0.1);

      clackGain.gain.setValueAtTime(0.5, t);
      clackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      clackOsc.connect(clackFilter);
      clackFilter.connect(clackGain);
      clackGain.connect(this.masterGain);
      clackOsc.start();
      clackOsc.stop(t + 0.15);

      // 3. The Burst (Noise texture)
      // Simulating noise with a buffer
      const bufferSize = this.ctx.sampleRate * 0.1; // 0.1 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5; // White noise
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      
      noise.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start();

    } else {
      // Glass/Hologram Ping (High Sine + FM)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.3);
      
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

      // Reverb-ish tail
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1190, t); // Detuned
      osc2.connect(gain);
      osc2.start();
      osc2.stop(t + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(t + 0.4);
    }
  }

  public playPhaseChange() {
    if (!this.ctx || !this.masterGain) return;
    // Sci-fi Sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  public playWin(isPlayer: boolean) {
    this.stopBGM();
    if (!this.ctx || !this.masterGain) return;

    if (isPlayer) {
      // Major Arpeggio
      [0, 0.1, 0.2, 0.3].forEach((delay, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        const notes = [440, 554, 659, 880]; // A Major
        osc.frequency.value = notes[i];
        
        gain.gain.setValueAtTime(0.3, this.ctx!.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + delay + 1.0);
        
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(this.ctx!.currentTime + delay);
        osc.stop(this.ctx!.currentTime + delay + 1.0);
      });
    } else {
      // System Failure (Dissonant)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(100, this.ctx.currentTime);
      osc1.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 1);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(110, this.ctx.currentTime); // Minor second (dissonant)
      
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);
      osc1.start();
      osc2.start();
      osc1.stop(this.ctx.currentTime + 1.5);
      osc2.stop(this.ctx.currentTime + 1.5);
    }
  }
}

export const audioManager = new AudioManager();