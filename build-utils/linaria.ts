import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

import {transform, TransformCacheCollection} from '@wyw-in-js/transform';

export const LINARIA_ROOTS = [
  'static/packages/scraps/src',
  'static/app/components/core/button',
  'static/app/components/core/dropdownMenu',
  'static/app/components/core/link',
].map(directory => path.resolve(import.meta.dirname, '..', directory));

export const LINARIA_OPTIONS = {configFile: false as const};
const cache = new TransformCacheCollection();

export function needsLinariaTransform(source: string): boolean {
  return /from ['"]@linaria\/core['"]/.test(source) && /css\s*`/.test(source);
}

/**
 * Match the StyleX spike's single stylesheet. Stable file order keeps styles
 * independent of lazy chunks and leaves Emotion wrappers later in the cascade.
 */
export async function collectLinariaCss(): Promise<string> {
  const files = (
    await Promise.all(
      LINARIA_ROOTS.map(async directory =>
        (await fs.readdir(directory, {recursive: true, withFileTypes: true}))
          .filter(
            entry =>
              entry.isFile() &&
              /\.tsx?$/.test(entry.name) &&
              !/\.(spec|d)\.tsx?$/.test(entry.name)
          )
          .map(entry => path.join(entry.parentPath, entry.name))
      )
    )
  )
    .flat()
    .sort();
  const styles = [];
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    if (needsLinariaTransform(source)) {
      styles.push((await transformLinaria(source, file)).cssText ?? '');
    }
  }
  return styles.join('\n');
}

export function transformLinaria(source: string, filename: string) {
  return transform(
    {
      cache,
      options: {
        filename,
        root: path.resolve(import.meta.dirname, '..'),
        pluginOptions: LINARIA_OPTIONS,
      },
    },
    source,
    async (request, importer) => createRequire(importer).resolve(request)
  );
}
