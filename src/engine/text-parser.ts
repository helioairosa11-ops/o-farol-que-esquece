import type { GameVariables } from './types';

export interface TextSegment {
  type: 'text' | 'pause';
  text?: string;
  italic?: boolean;
  bold?: boolean;
  pauseMs?: number;
}

/**
 * Replaces {varName} placeholders, extracts {pause:600} tags,
 * and parses **bold** and *italic* spans into flat segments for the typewriter.
 */
export function parseDialogueText(raw: string, vars?: GameVariables): TextSegment[] {
  const interpolated = raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, name) => {
    if (!vars) return full;
    if (name in vars && name !== 'flags') {
      return String(vars[name as Exclude<keyof GameVariables, 'flags'>]);
    }
    return full;
  });

  const parts = interpolated.split(/(\{pause:\d+\})/g);
  const segments: TextSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    const pauseMatch = part.match(/^\{pause:(\d+)\}$/);
    if (pauseMatch) {
      segments.push({ type: 'pause', pauseMs: Number(pauseMatch[1]) });
      continue;
    }
    parseInlineFormatting(part, segments);
  }

  return segments;
}

function parseInlineFormatting(input: string, out: TextSegment[]): void {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(input)) !== null) {
    if (match.index > lastIdx) {
      out.push({ type: 'text', text: input.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      out.push({ type: 'text', text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('*') && token.endsWith('*')) {
      out.push({ type: 'text', text: token.slice(1, -1), italic: true });
    }
    lastIdx = tokenRegex.lastIndex;
  }

  if (lastIdx < input.length) {
    out.push({ type: 'text', text: input.slice(lastIdx) });
  }
}

export function stripFormatting(raw: string, vars?: GameVariables): string {
  return parseDialogueText(raw, vars)
    .filter((s) => s.type === 'text')
    .map((s) => s.text ?? '')
    .join('');
}
