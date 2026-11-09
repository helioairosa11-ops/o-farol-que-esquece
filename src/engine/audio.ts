import type { GameSettings } from './types';

export interface MusicTrackMeta {
  id: string;
  title: string;
  subtitle: string;
  tempo: number; // BPM
  rootMidi: number; // e.g., 50 = D3
  chords: number[][]; // semitone offsets from rootMidi
  melody: (number | null)[]; // semitone offsets from rootMidi + 12, null = rest
  style: 'intimate_piano' | 'warm_cello' | 'glass_lullaby' | 'coastal_guitar';
}

export const MUSIC_TRACKS: MusicTrackMeta[] = [
  {
    id: 'tema_farol',
    title: 'O Feixe Sobre a Água',
    subtitle: 'Piano de feltro e violoncelo longo em Ré menor',
    tempo: 52,
    rootMidi: 50, // D3
    chords: [
      [0, 7, 12, 15],   // Dm9
      [-4, 3, 7, 12],   // Bbmaj7
      [-5, 0, 7, 12],   // Gmadd9
      [-2, 4, 7, 11],   // A7sus4
    ],
    melody: [12, 15, 19, null, 17, 15, 14, null, 12, 10, 7, null, 9, 10, 12, null],
    style: 'warm_cello',
  },
  {
    id: 'tema_ines',
    title: 'Palavras Sem Tradução',
    subtitle: 'Piano íntimo noturno com reverberação de catedral',
    tempo: 48,
    rootMidi: 52, // E3
    chords: [
      [0, 7, 11, 15],   // Em9
      [-4, 0, 7, 12],   // Cmaj7
      [-5, 2, 7, 11],   // Gmaj7
      [-2, 5, 9, 14],   // Dadd9
    ],
    melody: [19, 15, 14, null, 12, 11, 7, null, 11, 12, 15, null, 14, null, null, null],
    style: 'intimate_piano',
  },
  {
    id: 'tema_celeste',
    title: 'Chá de Lúcia-Lima',
    subtitle: 'Violoncelo acústico e dedilhado quente de guitarra',
    tempo: 54,
    rootMidi: 48, // C3
    chords: [
      [0, 7, 12, 16],   // Cmaj7
      [-3, 4, 9, 12],   // Am7
      [-7, 0, 5, 9],    // Fmaj7
      [-5, 2, 7, 11],   // G6
    ],
    melody: [16, 19, 21, null, 19, 16, 14, null, 12, 14, 16, null, 12, null, null, null],
    style: 'coastal_guitar',
  },
  {
    id: 'tema_mara',
    title: 'Menina das Dunas',
    subtitle: 'Três notas descendentes em harpa de vidro e mar calmo',
    tempo: 46,
    rootMidi: 55, // G3
    chords: [
      [0, 7, 10, 15],   // Gm
      [-4, 3, 7, 10],   // Ebmaj7
      [-2, 5, 8, 12],   // Fm7
      [-5, 2, 7, 10],   // Dm7
    ],
    // Signature 3 descending notes: Eb5 -> D5 -> C5
    melody: [20, 19, 17, null, null, 15, 14, 12, null, null, 20, 19, 17, null, null, null],
    style: 'glass_lullaby',
  },
  {
    id: 'tema_vila',
    title: 'Cal Branca e Calçada',
    subtitle: 'Acordes suaves de fim de tarde na costa',
    tempo: 56,
    rootMidi: 50, // D3
    chords: [
      [0, 7, 12, 16],
      [-5, 2, 7, 11],
      [-3, 4, 9, 13],
      [-5, 2, 7, 14],
    ],
    melody: [16, 14, 12, null, 14, 16, 19, null, 17, 16, 14, null, 12, null, null, null],
    style: 'coastal_guitar',
  },
  {
    id: 'tema_quarto',
    title: 'Duas Camas',
    subtitle: 'Piano suspenso e cordas graves na penumbra',
    tempo: 44,
    rootMidi: 49, // C#3
    chords: [
      [0, 7, 12, 15],
      [-4, 3, 8, 12],
      [-2, 5, 8, 12],
      [-5, 3, 7, 12],
    ],
    melody: [15, 14, 12, null, 7, null, 12, 10, 7, null, null, null, 3, null, null, null],
    style: 'warm_cello',
  },
];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class AdaptiveAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private currentTrackId: string | null = null;
  private currentAmbientId: string | null = null;
  private stepTimer: number | null = null;
  private ambientCleanup: (() => void) | null = null;
  private stepIndex = 0;
  private courageOffset = 0;

  private settings: GameSettings;

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      // Create lush algorithmic concert hall reverb impulse (3.4s tail)
      this.reverbNode = this.createConcertHallReverb(3.4, 2.6);
      const wetGain = this.ctx.createGain();
      const dryGain = this.ctx.createGain();
      wetGain.gain.value = 0.52;
      dryGain.gain.value = 0.68;

      this.musicGain.connect(dryGain);
      this.musicGain.connect(this.reverbNode);
      this.reverbNode.connect(wetGain);

      dryGain.connect(this.masterGain);
      wetGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.applySettings(this.settings);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createConcertHallReverb(durationSec: number, decay: number): ConvolverNode {
    const rate = this.ctx!.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = this.ctx!.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        const white = Math.random() * 2 - 1;
        // Low-pass dampened tail so high frequencies melt warmly like a real piano hall
        lp = lp * 0.88 + white * 0.12;
        data[i] = lp * env * 0.7;
      }
    }
    const convolver = this.ctx!.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  public applySettings(settings: GameSettings): void {
    this.settings = settings;
    if (!this.ctx || !this.musicGain || !this.ambientGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(settings.musicVol * 0.55, now, 0.12);
    this.ambientGain.gain.setTargetAtTime(settings.ambientVol * 0.25, now, 0.12);
    this.sfxGain.gain.setTargetAtTime(settings.sfxVol * 0.5, now, 0.06);
  }

  public setCourageBalance(coragem: number, negacao: number): void {
    this.courageOffset = coragem - negacao;
  }

  public playMusic(trackId: string | null): void {
    if (this.currentTrackId === trackId && this.stepTimer !== null) return;
    this.currentTrackId = trackId;
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (!trackId) return;
    const track = MUSIC_TRACKS.find((m) => m.id === trackId) ?? MUSIC_TRACKS[0];
    this.stepIndex = 0;

    const eighthMs = Math.round((60 / track.tempo / 2) * 1000);
    const tick = () => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.musicGain) return;
      this.scheduleStep(track, this.stepIndex++);
    };
    tick();
    this.stepTimer = window.setInterval(tick, eighthMs);
  }

  private scheduleStep(track: MusicTrackMeta, step: number): void {
    if (!this.ctx || !this.musicGain) return;
    const stepInBar = step % 4;
    const barIdx = Math.floor(step / 4) % track.chords.length;
    const chord = track.chords[barIdx];

    // 1. Rolled felt-piano chord & warm cello bass on beat 0 of every bar
    if (stepInBar === 0) {
      const barDurationSec = (60 / track.tempo) * 3.8;
      // Deep warm cello swell on root note
      this.playWarmCelloPad(midiToHz(track.rootMidi + chord[0] - 12), barDurationSec, 0.12);

      // Gently arpeggiated piano chord voicing
      chord.forEach((semi, idx) => {
        const delaySec = idx * 0.075;
        const freq = midiToHz(track.rootMidi + semi);
        this.playFeltPianoNote(freq, 3.2, 0.085 - idx * 0.01, delaySec);
      });

      // Adaptive courage stem: warm octave shimmer when coragem >= negacao
      if (this.courageOffset > 0) {
        const topSemi = chord[chord.length - 1] + 12;
        this.playWarmCelloPad(midiToHz(track.rootMidi + topSemi), barDurationSec * 0.85, 0.045);
      }
    }

    // 2. Expressive sparse melody note
    const melSemi = track.melody[step % track.melody.length];
    if (melSemi !== null && melSemi !== undefined) {
      const freq = midiToHz(track.rootMidi + melSemi);
      const isGlass = track.style === 'glass_lullaby';
      this.playFeltPianoNote(freq, isGlass ? 3.8 : 2.8, isGlass ? 0.11 : 0.135, 0.02);
    }
  }

  /**
   * Synthesizes a realistic, warm felt-piano note (like Gris / Florence):
   * - Soft hammer transient + warm fundamental sine + detuned 2nd harmonic + dynamic low-pass key filter
   */
  private playFeltPianoNote(
    freq: number,
    decaySec: number,
    peakGain: number,
    delaySec = 0
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const start = this.ctx.currentTime + delaySec;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, start);
    osc2.frequency.setValueAtTime(freq * 2, start); // 2nd harmonic octave
    osc2.detune.setValueAtTime(3.5, start); // warm chorus detune

    const g1 = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    g1.gain.value = 0.82;
    g2.gain.value = 0.14; // subtle overtone

    // Felt damper low-pass filter that starts gently bright and darkens as the note rings out
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2400, freq * 4.2), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(280, freq * 1.15), start + decaySec);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peakGain, start + 0.035); // soft felt hammer attack
    env.gain.exponentialRampToValueAtTime(peakGain * 0.32, start + 0.45);
    env.gain.exponentialRampToValueAtTime(0.0002, start + decaySec);

    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(filter);
    g2.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    osc1.start(start);
    osc2.start(start);
    osc1.stop(start + decaySec + 0.08);
    osc2.stop(start + decaySec + 0.08);
  }

  /**
   * Synthesizes a bowed cello / warm pad swell with gentle vibrato and low-pass warmth
   */
  private playWarmCelloPad(freq: number, durationSec: number, peakGain: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.setValueAtTime(-6, now);

    const g2 = this.ctx.createGain();
    g2.gain.value = 0.25;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.linearRampToValueAtTime(520, now + durationSec * 0.45);
    filter.frequency.linearRampToValueAtTime(280, now + durationSec);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + durationSec * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0003, now + durationSec);

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.08);
    osc2.stop(now + durationSec + 0.08);
  }

  public playAmbient(ambientId: string | null): void {
    if (this.currentAmbientId === ambientId) return;
    this.currentAmbientId = ambientId;
    if (this.ambientCleanup) {
      this.ambientCleanup();
      this.ambientCleanup = null;
    }
    if (!ambientId || !this.ctx || !this.ambientGain) return;

    // Soft brown/pink noise for realistic distant ocean surf or hearth warmth
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 0.45;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = ambientId === 'comboio' ? 160 : ambientId === 'cozinha' ? 240 : 210;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = ambientId === 'comboio' ? 1.6 : 0.11; // 9-second ocean wave period
    lfoGain.gain.value = ambientId === 'comboio' ? 45 : 85;
    lfo.connect( lfoGain );
    lfoGain.connect(filter.frequency);

    const localGain = this.ctx.createGain();
    localGain.gain.value = 0.32;

    noise.connect(filter);
    filter.connect(localGain);
    localGain.connect(this.ambientGain);

    noise.start();
    lfo.start();

    this.ambientCleanup = () => {
      try {
        noise.stop();
        lfo.stop();
        localGain.disconnect();
      } catch {
        // Ignore
      }
    };
  }

  public playSfx(kind: string): void {
    if (!this.ctx || !this.sfxGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;

    if (kind === 'knock3') {
      [0, 0.36, 0.72].forEach((offset) => {
        this.triggerWoodKnock(now + offset);
      });
      return;
    }

    if (kind === 'bell' || kind === 'memory') {
      const freq = kind === 'memory' ? 587.33 : 523.25;
      this.playFeltPianoNote(freq, 2.2, 0.16, 0);
      if (kind === 'memory') {
        this.playFeltPianoNote(freq * 1.5, 2.5, 0.12, 0.14);
      }
      return;
    }

    if (kind === 'foghorn') {
      this.playWarmCelloPad(73.42, 2.8, 0.22); // Deep D2 horn
      return;
    }

    if (kind === 'paper' || kind === 'choice' || kind === 'click') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(kind === 'paper' ? 280 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  }

  private triggerWoodKnock(startTime: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(155, startTime);
    osc.frequency.exponentialRampToValueAtTime(62, startTime + 0.09);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(220, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.42, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(startTime);
    osc.stop(startTime + 0.12);
  }
}
