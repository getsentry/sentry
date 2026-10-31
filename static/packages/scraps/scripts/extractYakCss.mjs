/* eslint-disable import/no-nodejs-modules */
import {Buffer} from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';

// Rslib's bundle:false output preserves Yak's CSS data imports. Publish one
// stylesheet and keep the JavaScript safe to import from Node, as in the Linaria spike.
const dist = path.resolve(import.meta.dirname, '../dist');
const styles = new Set();
async function extract(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await extract(filename);
    } else if (entry.name.endsWith('.js')) {
      const source = await fs.readFile(filename, 'utf8');
      const output = source.replace(
        /import ["']data:text\/css;base64,([^"']*)["'];?\n?/g,
        (_, encoded) => {
          styles.add(Buffer.from(encoded, 'base64').toString('utf8'));
          return '';
        }
      );
      if (output !== source) {
        await fs.writeFile(filename, output);
      }
    }
  }
}
await extract(dist);
await fs.writeFile(path.join(dist, 'styles.css'), [...styles].join('\n'));
