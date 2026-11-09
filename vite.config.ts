import { defineConfig, type Plugin } from 'vite';
import YAML from 'yaml';

/** Converte os scripts .yaml em módulos JSON durante o build. */
function yamlScripts(): Plugin {
  return {
    name: 'yaml-scripts',
    transform(code, id) {
      if (!id.endsWith('.yaml')) return null;
      const data = YAML.parse(code);
      return { code: `export default ${JSON.stringify(data)};`, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [yamlScripts()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
  },
} as any);
