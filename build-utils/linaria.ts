import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

import {transform, TransformCacheCollection} from '@wyw-in-js/transform';

import {theme} from '../static/packages/scraps/src/theme/linaria.ts';

export const LINARIA_ROOTS = [
  'static/packages/scraps/src',
  'static/app/components/core',
  'static/app',
  'static/gsApp',
  'static/gsAdmin',
].map(directory => path.resolve(import.meta.dirname, '..', directory));

export const LINARIA_OPTIONS = {
  configFile: false as const,
  // These generated values are static. Inline tags must not evaluate the
  // surrounding React component or its runtime-only imports to resolve them.
  staticBindings: {'@sentry/scraps/theme': {theme}},
  eval: {strategy: 'static' as const},
};
const cache = new TransformCacheCollection();

export function needsLinariaTransform(source: string): boolean {
  return /from ['"]@linaria\/core['"]/.test(source) && /\b\w+\s*`/.test(source);
}

/**
 * Match the StyleX spike's single stylesheet. Stable file order keeps styles
 * independent of lazy chunks. Core styles come first, then custom app classes.
 * Emotion wrappers follow the extracted stylesheet in the cascade.
 */
export async function collectLinariaCss(roots = LINARIA_ROOTS): Promise<string> {
  const filesByRoot = await Promise.all(
    roots.map(async directory =>
      (await fs.readdir(directory, {recursive: true, withFileTypes: true}))
        .filter(
          entry =>
            entry.isFile() &&
            /\.tsx?$/.test(entry.name) &&
            !/\.(spec|d)\.tsx?$/.test(entry.name)
        )
        .map(entry => path.join(entry.parentPath, entry.name))
        .sort()
    )
  );
  const files = [...new Set(filesByRoot.flat())];
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
    resolveLinariaImport
  );
}

async function resolveLinariaImport(request: string, importer: string) {
  try {
    return createRequire(importer).resolve(request);
  } catch (error) {
    // Node does not resolve extensionless TypeScript imports.
    if (request.startsWith('.')) {
      const base = path.resolve(path.dirname(importer), request);
      for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const filename = `${base}${suffix}`;
        try {
          await fs.access(filename);
          return filename;
        } catch {
          // Try the next TypeScript extension.
        }
      }
    }
    throw error;
  }
}
