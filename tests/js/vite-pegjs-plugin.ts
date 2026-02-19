import peggy from 'peggy';
import type {Plugin} from 'vite';

/**
 * Vite plugin to transform PEG.js grammar files into JavaScript modules.
 * Equivalent of tests/js/jest-pegjs-transform.js for the Vitest pipeline.
 */
export default function pegjsPlugin(): Plugin {
  return {
    name: 'vite-pegjs',
    transform(src, id) {
      if (!id.endsWith('.pegjs')) {
        return undefined;
      }
      const code = peggy.generate(src, {output: 'source', format: 'es'});
      return {code, map: null};
    },
  };
}
