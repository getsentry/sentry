import peggy from 'peggy';
import type {Plugin} from 'vite';

export default function pegjsPlugin(): Plugin {
  return {
    name: 'vite:pegjs',
    transform(code: string, id: string) {
      if (!id.endsWith('.pegjs')) {
        return null;
      }

      return {
        code: `export default ${peggy.generate(code, {output: 'source'})};`,
        map: null,
      };
    },
  };
}
