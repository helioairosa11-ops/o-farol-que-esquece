import type { GameSettings, GameVariables, PersistentMeta } from './types';

const META_KEY = 'farol_meta_v1';
const SETTINGS_KEY = 'farol_settings_v1';

export function createInitialVariables(): GameVariables {
  return {
    memoriasRecolhidas: 0,
    confiancaDuarte: 0,
    confiancaCeleste: 0,
    confiancaAnselmo: 0,
    confiancaGraca: 0,
    coragem: 0,
    negacao: 0,
    flags: {},
  };
}

export function cloneVariables(v: GameVariables): GameVariables {
  return {
    ...v,
    flags: { ...v.flags },
  };
}

export function applyVariableMutations(
  vars: GameVariables,
  mutations: Record<string, number | boolean | string>
): void {
  for (const [key, rawVal] of Object.entries(mutations)) {
    if (key === 'flag' && typeof rawVal === 'string') {
      vars.flags[rawVal] = true;
      continue;
    }
    if (key.startsWith('flag.')) {
      const flagName = key.slice(5);
      vars.flags[flagName] = Boolean(rawVal);
      continue;
    }
    if (key in vars && key !== 'flags') {
      const k = key as Exclude<keyof GameVariables, 'flags'>;
      if (typeof rawVal === 'number') {
        // In YAML scripts, `confiancaCeleste: +1` or `-1` is parsed as number delta
        vars[k] = clampVariable(k, vars[k] + rawVal);
      } else if (typeof rawVal === 'string') {
        const trimmed = rawVal.trim();
        if (trimmed.startsWith('=') && !Number.isNaN(Number(trimmed.slice(1)))) {
          vars[k] = clampVariable(k, Number(trimmed.slice(1)));
        } else if (!Number.isNaN(Number(trimmed))) {
          vars[k] = clampVariable(k, vars[k] + Number(trimmed));
        }
      }
    } else {
      vars.flags[key] = Boolean(rawVal);
    }
  }
}

function clampVariable(key: Exclude<keyof GameVariables, 'flags'>, val: number): number {
  if (key === 'memoriasRecolhidas') return Math.max(0, Math.min(12, val));
  if (key.startsWith('confianca')) return Math.max(-3, Math.min(5, val));
  return Math.max(0, val);
}

/**
 * Evaluates condition expressions like:
 * - "viuPegadas"
 * - "!perguntouLucia"
 * - "confiancaCeleste >= 1 && coragem > negacao"
 */
export function evaluateCondition(expr: string | undefined, vars: GameVariables): boolean {
  if (!expr || !expr.trim()) return true;

  const orParts = expr.split('||').map((s) => s.trim());
  if (orParts.length > 1) {
    return orParts.some((part) => evaluateCondition(part, vars));
  }

  const andParts = expr.split('&&').map((s) => s.trim());
  if (andParts.length > 1) {
    return andParts.every((part) => evaluateCondition(part, vars));
  }

  const clause = expr.trim();
  if (clause.startsWith('!')) {
    return !evaluateCondition(clause.slice(1).trim(), vars);
  }

  const match = clause.match(/^([a-zA-Z0-9_.]+)\s*(>=|<=|==|!=|>|<)\s*([a-zA-Z0-9_.-]+)$/);
  if (match) {
    const [, leftToken, op, rightToken] = match;
    const leftVal = resolveToken(leftToken, vars);
    const rightVal = resolveToken(rightToken, vars);
    switch (op) {
      case '>=':
        return Number(leftVal) >= Number(rightVal);
      case '<=':
        return Number(leftVal) <= Number(rightVal);
      case '>':
        return Number(leftVal) > Number(rightVal);
      case '<':
        return Number(leftVal) < Number(rightVal);
      case '==':
        return leftVal === rightVal;
      case '!=':
        return leftVal !== rightVal;
    }
  }

  const val = resolveToken(clause, vars);
  return Boolean(val);
}

function resolveToken(token: string, vars: GameVariables): number | boolean | string {
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (!Number.isNaN(Number(token))) return Number(token);
  if (token.startsWith('flag.')) {
    return Boolean(vars.flags[token.slice(5)]);
  }
  if (token in vars && token !== 'flags') {
    return vars[token as Exclude<keyof GameVariables, 'flags'>];
  }
  return Boolean(vars.flags[token]);
}

export function loadPersistentMeta(): PersistentMeta {
  const fallback: PersistentMeta = {
    unlockedWords: ['saudade'],
    unlockedCGs: [],
    unlockedMemories: [],
    unlockedEndings: [],
    readLines: {},
  };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      unlockedWords: Array.isArray(parsed.unlockedWords) ? parsed.unlockedWords : ['saudade'],
      unlockedCGs: Array.isArray(parsed.unlockedCGs) ? parsed.unlockedCGs : [],
      unlockedMemories: Array.isArray(parsed.unlockedMemories) ? parsed.unlockedMemories : [],
      unlockedEndings: Array.isArray(parsed.unlockedEndings) ? parsed.unlockedEndings : [],
      readLines: parsed.readLines && typeof parsed.readLines === 'object' ? parsed.readLines : {},
    };
  } catch {
    return fallback;
  }
}

export function savePersistentMeta(meta: PersistentMeta): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore quota errors
  }
}

export function loadSettings(): GameSettings {
  const defaults: GameSettings = {
    locale: 'pt-PT',
    textSpeed: 24,
    autoDelay: 2200,
    fontFamily: 'default',
    fontSize: 'medium',
    highContrast: false,
    reduceMotion: false,
    disableTimers: false,
    soundCaptions: true,
    musicVol: 0.75,
    ambientVol: 0.7,
    sfxVol: 0.8,
    voiceVol: 0.9,
  };
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: GameSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}
