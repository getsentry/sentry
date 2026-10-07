/**
 * Shared StyleX compilation for the rspack loaders and the jest transform.
 *
 * Files under `STYLEX_ROOTS` that import `@stylexjs/stylex` are compiled with
 * `@stylexjs/babel-plugin` before swc, and their CSS is collected into a
 * single stylesheet (see `stylex-css-loader.ts`).
 *
 * Cascade order: StyleX rules are emitted as plain single-class selectors
 * (`legacyDisableLayers`), and the stylesheet is injected after the LESS
 * stylesheet and before Emotion's runtime `<style>` tags. So LESS < StyleX <
 * Emotion: `styled(Flex)` wrappers keep overriding the primitives they wrap.
 * StyleX's default (`:not(#\#)` specificity bumps) would invert that.
 */
import fs from 'node:fs';
import path from 'node:path';

import {transformAsync, transformSync, type TransformOptions} from '@babel/core';
import stylexBabelPlugin from '@stylexjs/babel-plugin';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCRAPS_SRC = path.join(ROOT, 'static/packages/scraps/src');
const CORE_COMPONENTS = path.join(ROOT, 'static/app/components/core');

export const STYLEX_IMPORT = '@stylexjs/stylex';

/**
 * Directories that may use StyleX: the @sentry/scraps package and the app.
 * Files without a `@stylexjs/stylex` import pass through the loader untouched.
 */
export const STYLEX_ROOTS = [
  SCRAPS_SRC,
  path.join(ROOT, 'static/app'),
  path.join(ROOT, 'static/gsApp'),
];

type StylexRule = Parameters<typeof stylexBabelPlugin.processStylexRules>[0][number];

function getPluginOptions(runtimeInjection: boolean) {
  return {
    dev: false,
    test: false,
    runtimeInjection,
    treeshakeCompensation: true,
    // StyleX silently drops some shorthands (`border*`, `background`,
    // `animation`) in its default `property-specificity` mode; fail instead.
    propertyValidationMode: 'throw' as const,
    // Resolve `@sentry/scraps/*` imports of `.stylex.ts` files the same way
    // rspack does, so variables hash identically wherever they are imported.
    aliases: {
      '@sentry/scraps/*': [`${SCRAPS_SRC}/*`, `${CORE_COMPONENTS}/*`],
      'sentry/*': [path.join(ROOT, 'static/app/*')],
      'getsentry/*': [path.join(ROOT, 'static/gsApp/*')],
    },
    unstable_moduleResolution: {type: 'commonJS' as const, rootDir: ROOT},
  };
}

function getBabelOptions(
  filename: string,
  {runtimeInjection = false, inputSourceMap}: TransformStylexOptions = {}
): TransformOptions {
  return {
    filename,
    babelrc: false,
    configFile: false,
    // Only StyleX is compiled here; swc handles TypeScript and JSX afterwards.
    parserOpts: {
      plugins: filename.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
    },
    plugins: [[stylexBabelPlugin, getPluginOptions(runtimeInjection)]],
    sourceMaps: true,
    inputSourceMap: inputSourceMap ?? undefined,
  };
}

interface TransformStylexOptions {
  inputSourceMap?: any;
  /**
   * Inject styles at runtime instead of collecting them (jest only).
   */
  runtimeInjection?: boolean;
}

export function needsStylexTransform(source: string): boolean {
  return source.includes(STYLEX_IMPORT);
}

export async function transformStylex(
  source: string,
  filename: string,
  options?: TransformStylexOptions
) {
  const result = await transformAsync(source, getBabelOptions(filename, options));
  return {
    code: result?.code ?? source,
    map: result?.map ?? null,
    rules: ((result?.metadata as any)?.stylex ?? []) as StylexRule[],
  };
}

export function transformStylexSync(
  source: string,
  filename: string,
  options?: TransformStylexOptions
) {
  const result = transformSync(source, getBabelOptions(filename, options));
  return {code: result?.code ?? source, map: result?.map ?? null};
}

function listSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listSourceFiles(fullPath, files);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(spec|d)\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const rulesCache = new Map<string, {mtimeMs: number; rules: StylexRule[]}>();

/**
 * Compiles every StyleX file under `STYLEX_ROOTS` and returns the combined CSS.
 * Files are re-compiled only when their mtime changes.
 */
export async function collectStylexCss(): Promise<string> {
  const files = STYLEX_ROOTS.flatMap(root => listSourceFiles(root));
  const seen = new Set(files);
  for (const file of rulesCache.keys()) {
    if (!seen.has(file)) {
      rulesCache.delete(file);
    }
  }

  await Promise.all(
    files.map(async file => {
      const {mtimeMs} = fs.statSync(file);
      if (rulesCache.get(file)?.mtimeMs === mtimeMs) {
        return;
      }
      const source = fs.readFileSync(file, 'utf8');
      const rules = needsStylexTransform(source)
        ? (await transformStylex(source, file)).rules
        : [];
      rulesCache.set(file, {mtimeMs, rules});
    })
  );

  // Sort by file so the output does not depend on the traversal order.
  const rules = [...rulesCache.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, entry]) => entry.rules);

  return stylexBabelPlugin.processStylexRules(rules, {
    useLayers: false,
    legacyDisableLayers: true,
  });
}
