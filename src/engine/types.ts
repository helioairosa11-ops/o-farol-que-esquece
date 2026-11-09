export type LocaleCode = 'pt-PT' | 'pt-BR' | 'en';

export interface GameVariables {
  memoriasRecolhidas: number;
  confiancaDuarte: number;
  confiancaCeleste: number;
  confiancaAnselmo: number;
  confiancaGraca: number;
  coragem: number;
  negacao: number;
  flags: Record<string, boolean>;
}

export interface PersistentMeta {
  unlockedWords: string[];
  unlockedCGs: string[];
  unlockedMemories: string[];
  unlockedEndings: string[];
  readLines: Record<string, boolean>;
}

export interface GameSettings {
  locale: LocaleCode;
  textSpeed: number; // ms per char (0 = instant, 25 = normal, 50 = slow)
  autoDelay: number; // ms after line finishes
  fontFamily: 'default' | 'hyperlegible' | 'dyslexic';
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reduceMotion: boolean;
  disableTimers: boolean;
  soundCaptions: boolean;
  musicVol: number;
  ambientVol: number;
  sfxVol: number;
  voiceVol: number;
}

export interface BacklogEntry {
  scene: string;
  pc: number;
  who?: string;
  speakerName?: string;
  text: string;
}

export interface ScriptHotspot {
  id: string;
  x: number; // percentage 0..100
  y: number;
  radius?: number;
  title: string;
  wordId?: string;
  cg?: string;
  lines: ScriptNode[];
}

export interface ScriptChoiceOption {
  text: string;
  when?: string;
  set?: Record<string, number | boolean | string>;
  remember?: boolean;
  word?: string;
  goto?: string;
  lines?: ScriptNode[];
}

export interface ScriptChoice {
  prompt?: string;
  timeoutMs?: number;
  defaultIndex?: number;
  options: ScriptChoiceOption[];
}

export type ScriptNode =
  | {
      who?: string;
      name?: string;
      expr?: string;
      pos?: 'left' | 'center' | 'right';
      text: string;
      voice?: string;
      sfx?: string;
      caption?: string;
      effect?: 'shake' | 'flash' | 'pulse' | 'focus' | 'clearFocus' | 'beamFlicker';
      word?: string;
      remember?: boolean;
    }
  | { bg: string; transition?: 'fade' | 'brush' | 'tear' | 'instant'; chapterPalette?: string }
  | { cg: string | null; caption?: string }
  | { sprite: string; expr?: string; pos?: 'left' | 'center' | 'right'; hide?: boolean }
  | { music: string | null }
  | { ambient: string | null }
  | { sfx: string; caption?: string }
  | { chapterCard: { number: string; title: string; quote: string; image: string } }
  | { hotspotScene: { prompt: string; hotspots: ScriptHotspot[]; continueGoto?: string } }
  | { set: Record<string, number | boolean | string>; remember?: boolean }
  | { if: string; then: ScriptNode[]; else?: ScriptNode[] }
  | { choice: ScriptChoice | ScriptChoiceOption[] }
  | { goto: string }
  | { ending: { id: string; code: string; title: string; subtitle: string; finalParagraph: string } };

export interface SceneDefinition {
  scene: string;
  title?: string;
  chapter?: string;
  bg?: string;
  music?: string;
  ambient?: string;
  palette?: 'prologo' | 'cap1' | 'cap2' | 'cap3' | 'cap4' | 'epilogo';
  lines: ScriptNode[];
}

export interface SaveSlotData {
  slotId: string;
  timestamp: number;
  chapterTitle: string;
  sceneId: string;
  pc: number;
  bg: string;
  cg: string | null;
  music: string | null;
  ambient: string | null;
  sprites: Record<string, { expr: string; pos: 'left' | 'center' | 'right' }>;
  previewText: string;
  vars: GameVariables;
  backlog: BacklogEntry[];
}
