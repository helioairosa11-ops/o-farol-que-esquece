import type { GameSettings } from './types';

export interface MusicTrackMeta {
  id: string;
  title: string;
  subtitle: string;
  tempo: number;
  rootHz: number;
  scale: number[]; // semitone offsets
  progression: number[][]; // scale degree chords
  motif: number[]; // semitone offsets for lead motif
  timbre: 'piano' | 'cello' | 'guitarra' | 'glass';
}

export const MUSIC_TRACKS: MusicTrackMeta[] = [
  {
    id: 'tema_farol',
    title: 'O Feixe Sobre a Água',
    subtitle: 'Tema do Farol (ascendente, piano e violoncelo)',
    tempo: 62,
    rootHz: 146.83, // D3
    scale: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15],
    progression: [
      [0, 2, 4],
      [5, 7, 9],
      [3, 5, 7],
      [4, 6, 8],
    ],
    motif: [0, 3, 7, 12, 10, 7], // ascending lighthouse motif
    timbre: 'piano',
  },
  {
    id: 'tema_ines',
    title: 'Palavras Sem Tradução',
    subtitle: 'Tema de Inês (piano íntimo e caderno)',
    tempo: 58,
    rootHz: 164.81, // E3
    scale: [0, 2, 3, 5, 7, 8, 11, 12, 14],
    progression: [
      [0, 2, 4],
      [3, 5, 7],
      [5, 7, 9],
      [4, 6, 8],
    ],
    motif: [7, 5, 3, 2, 3, 7],
    timbre: 'piano',
  },
  {
    id: 'tema_celeste',
    title: 'Chá de Lúcia-Lima',
    subtitle: 'Tema da Avó Celeste (violoncelo quente e guitarra portuguesa)',
    tempo: 64,
    rootHz: 130.81, // C3
    scale: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16],
    progression: [
      [0, 2, 4],
      [5, 0, 2],
      [3, 5, 7],
      [4, 6, 1],
    ],
    motif: [4, 7, 9, 7, 4, 2, 0],
    timbre: 'guitarra',
  },
  {
    id: 'tema_mara',
    title: 'Menina das Dunas',
    subtitle: 'Tema da Mara (três notas descendentes em vidro e harpa)',
    tempo: 54,
    rootHz: 196.0, // G3
    scale: [0, 2, 3, 5, 7, 8, 10, 12, 15],
    progression: [
      [0, 2, 4],
      [5, 7, 2],
      [3, 5, 0],
      [4, 7, 1],
    ],
    motif: [10, 8, 7, -1, 10, 8, 7], // 3 descending notes signature
    timbre: 'glass',
  },
  {
    id: 'tema_vila',
    title: 'Cal Branca e Calçada',
    subtitle: 'Tema da Vila de Névoa (guitarra portuguesa subtil)',
    tempo: 72,
    rootHz: 146.83,
    scale: [0, 2, 4, 5, 7, 9, 10, 12, 14],
    progression: [
      [0, 2, 4],
      [3, 5, 7],
      [0, 2, 4],
      [4, 6, 8],
    ],
    motif: [0, 4, 7, 9, 7, 4],
    timbre: 'guitarra',
  },
  {
    id: 'tema_quarto',
    title: 'Duas Camas',
    subtitle: 'Noturno da casa de infância (piano suspenso e eco)',
    tempo: 50,
    rootHz: 138.59, // C#3
    scale: [0, 2, 3, 5, 7, 8, 10, 12, 15],
    progression: [
      [0, 2, 4],
      [5, 7, 2],
      [3, 5, 7],
      [0, 4, 7],
    ],
    motif: [10, 8, 7, 3, 2, 0],
    timbre: 'cello',
  },
];

export class AdaptiveAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private currentTrackId: string | null = null;
  private currentAmbientId: string | null = null;
  private stepTimer: number | null = null;
  private ambientCleanup: (() => void) | null = null;
  private stepIndex = 0;
  private courageOffset = 0; // coragem - negacao controls harmonic warmth & cello stem

  private settings: GameSettings;

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applySettings(this.settings);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public applySettings(settings: GameSettings): void {
    this.settings = settings;
    if (!this.ctx || !this.musicGain || !this.ambientGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(settings.musicVol * 0.45, now, 0.08);
    this.ambientGain.gain.setTargetAtTime(settings.ambientVol * 0.35, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(settings.sfxVol * 0.55, now, 0.05);
  }

  public setCourageBalance(coragem: number, negacao: number): void {
    this.courageOffset = coragem - negacao;
  }

  public playMusic(trackId: string | null): void {
    if (this.currentTrackId === trackId) return;
    this.currentTrackId = trackId;
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (!trackId) return;
    const track = MUSIC_TRACKS.find((m) => m.id === trackId) ?? MUSIC_TRACKS[0];
    this.stepIndex = 0;

    const beatMs = Math.round((60 / track.tempo) * 1000);
    const tick = () => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.musicGain) return;
      this.scheduleMusicBeat(track, this.stepIndex++);
    };
    tick();
    this.stepTimer = window.setInterval(tick, beatMs);
  }

  private scheduleMusicBeat(track: MusicTrackMeta, step: number): void {
    if (!this.ctx || !this.musicGain) return;
    const bar = Math.floor(step / 4) % track.progression.length;
    const beatInBar = step % 4;
    const chord = track.progression[bar];

    // Warm pad / cello stem on beat 0
    if (beatInBar === 0) {
      const rootSemitone = track.scale[chord[0]] ?? 0;
      const rootFreq = track.rootHz * Math.pow(2, rootSemitone / 12);
      this.triggerPadNote(rootFreq, (60 / track.tempo) * 3.8, 0.16);

      // Adaptive stem: if coragem >= negacao, add warm fifth cello harmonic
      if (this.courageOffset >= 0) {
        const fifthSemitone = track.scale[chord[2]] ?? 7;
        const fifthFreq = track.rootHz * Math.pow(2, fifthSemitone / 12);
        this.triggerPadNote(fifthFreq, (60 / track.tempo) * 3.4, 0.09);
      }
    }

    // Arpeggio / motif notes
    const motifIdx = step % track.motif.length;
    const motifSemi = track.motif[motifIdx];
    if (motifSemi >= 0) {
      const freq = track.rootHz * 2 * Math.pow(2, motifSemi / 12);
      this.triggerPluckOrPiano(freq, track.timbre, beatInBar === 0 ? 0.22 : 0.14);
    }
  }

  private triggerPadNote(freq: number, durationSec: number, peak: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420 + Math.max(0, this.courageOffset) * 60, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc.stop(now + durationSec + 0.05);
  }

  private triggerPluckOrPiano(freq: number, timbre: MusicTrackMeta['timbre'], peak: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = timbre === 'guitarra' ? 'triangle' : timbre === 'glass' ? 'sine' : 'triangle';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    sub.frequency.setValueAtTime(freq * (timbre === 'guitarra' ? 2 : 0.5), now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(timbre === 'guitarra' ? 1800 : 1200, now);

    const decay = timbre === 'glass' ? 2.4 : 1.75;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + decay);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    sub.start(now);
    osc.stop(now + decay + 0.05);
    sub.stop(now + decay + 0.05);
  }

  public playAmbient(ambientId: string | null): void {
    if (this.currentAmbientId === ambientId) return;
    this.currentAmbientId = ambientId;
    if (this.ambientCleanup) {
      this.ambientCleanup();
      this.ambientCleanup = null;
    }
    if (!ambientId || !this.ctx || !this.ambientGain) return;

    // Create pink-ish noise buffer for sea/wind/train/hearth
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      b3 = 0.850 * b3 + white * 0.065;
      data[i] = (b0 + b1 + b2 + b3 + white * 0.04) * 0.35;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = ambientId === 'comboio' ? 190 : ambientId === 'cozinha' ? 320 : 260;
    filter.Q.value = ambientId === 'mar_vento' ? 1.4 : 0.9;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = ambientId === 'comboio' ? 2.2 : 0.14; // wave swell or train cadence
    lfoGain.gain.value = ambientId === 'comboio' ? 95 : 130;
    lfo.connect(filter.frequency);

    const localGain = this.ctx.createGain();
    localGain.gain.value = 0.45;

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
      // Three distinct wooden window knocks: toc, toc, toc
      [0, 0.34, 0.68].forEach((offset) => {
        this.triggerWoodKnock(now + offset);
      });
      return;
    }

    if (kind === 'bell' || kind === 'memory') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(kind === 'memory' ? 784 : 659.25, now);
      osc.frequency.exponentialRampToValueAtTime(kind === 'memory' ? 1174.66 : 523.25, now + 0.9);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 1.1);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 1.15);
      return;
    }

    if (kind === 'foghorn') {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(87.31, now); // F2 deep horn
      osc.frequency.linearRampToValueAtTime(82.41, now + 2.4);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.6);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 2.65);
      return;
    }

    if (kind === 'paper' || kind === 'choice' || kind === 'click') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(kind === 'paper' ? 320 : 520, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  }

  private triggerWoodKnock(startTime: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165, startTime);
    osc.frequency.exponentialRampToValueAtTime(68, startTime + 0.09);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(240, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.45, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(startTime);
    osc.stop(startTime + 0.12);
  }
}
