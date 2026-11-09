import ptPT from '../locales/pt-PT.json';
import ptBR from '../locales/pt-BR.json';
import en from '../locales/en.json';
import type { LocaleCode } from './types';

const DICTS: Record<LocaleCode, Record<string, any>> = {
  'pt-PT': ptPT,
  'pt-BR': ptBR,
  en,
};

let currentLocale: LocaleCode = 'pt-PT';

export function setLocale(locale: LocaleCode): void {
  currentLocale = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

export function getLocale(): LocaleCode {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let node: any = DICTS[currentLocale] ?? DICTS['pt-PT'];
  for (const p of parts) {
    node = node?.[p];
  }
  let str = typeof node === 'string' ? node : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
