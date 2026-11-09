import { describe, expect, it } from 'vitest';
import {
  applyVariableMutations,
  createInitialVariables,
  evaluateCondition,
} from '../src/engine/state';
import { parseDialogueText, stripFormatting } from '../src/engine/text-parser';

describe('Engine State & Variable System', () => {
  it('initializes variables with expected ranges', () => {
    const vars = createInitialVariables();
    expect(vars.memoriasRecolhidas).toBe(0);
    expect(vars.confiancaCeleste).toBe(0);
    expect(vars.coragem).toBe(0);
    expect(vars.negacao).toBe(0);
  });

  it('applies numeric deltas, clamps trust to [-3, 5] and sets boolean flags', () => {
    const vars = createInitialVariables();
    applyVariableMutations(vars, {
      confiancaCeleste: 2,
      coragem: 1,
      memoriasRecolhidas: 3,
      'flag.abracouAvo': true,
    });
    expect(vars.confiancaCeleste).toBe(2);
    expect(vars.coragem).toBe(1);
    expect(vars.memoriasRecolhidas).toBe(3);
    expect(vars.flags.abracouAvo).toBe(true);

    applyVariableMutations(vars, { confiancaCeleste: 10 });
    expect(vars.confiancaCeleste).toBe(5);
  });

  it('evaluates compound boolean expressions accurately', () => {
    const vars = createInitialVariables();
    applyVariableMutations(vars, {
      confiancaCeleste: 2,
      coragem: 3,
      negacao: 1,
      'flag.viuPegadas': true,
    });

    expect(evaluateCondition('viuPegadas', vars)).toBe(true);
    expect(evaluateCondition('!viuPegadas', vars)).toBe(false);
    expect(evaluateCondition('confiancaCeleste >= 2 && coragem > negacao', vars)).toBe(true);
    expect(evaluateCondition('confiancaCeleste >= 4 || viuPegadas', vars)).toBe(true);
  });
});

describe('Dialogue Text Parser', () => {
  it('parses pauses, italics, bold, and variable interpolation', () => {
    const vars = createInitialVariables();
    vars.memoriasRecolhidas = 4;

    const segments = parseDialogueText(
      'Encosto a testa. {pause:450}*Dez anos* e **{memoriasRecolhidas}** memórias.',
      vars
    );

    expect(segments.some((s) => s.type === 'pause' && s.pauseMs === 450)).toBe(true);
    expect(segments.some((s) => s.italic && s.text === 'Dez anos')).toBe(true);
    expect(segments.some((s) => s.bold && s.text === '4')).toBe(true);
    expect(stripFormatting('*Olá* **mundo** {pause:200}')).toBe('Olá mundo ');
  });
});
