import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {build} from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const entries = {};
const sourceRoot = resolve(root, '.generated/src');
execFileSync('node', ['scripts/sync.mjs'], {cwd: root, stdio: 'inherit'});
await rm(resolve(root, 'dist'), {recursive: true, force: true});

for (const [subpath, target] of Object.entries(packageJson.exports)) {
  const output = target.import.replace(/^\.\/dist\//, '').replace(/\.js$/, '');
  const source = ['.tsx', '.ts']
    .map(extension => resolve(sourceRoot, output + extension))
    .find(existsSync);
  if (!source) {
    throw new Error(`Missing source for ${subpath}`);
  }
}
for (const relative of await readdir(sourceRoot, {recursive: true})) {
  if (!/\.tsx?$/.test(relative)) {
    continue;
  }
  entries[relative.replace(/\.tsx?$/, '')] = resolve(sourceRoot, relative);
}

const result = await build({
  entryPoints: entries,
  outdir: resolve(root, 'dist'),
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  jsxImportSource: '@emotion/react',
  metafile: true,
  write: true,
  logLevel: 'warning',
});

const dependencies = {...packageJson.dependencies, ...packageJson.peerDependencies};
for (const output of Object.values(result.metafile.outputs)) {
  for (const imported of output.imports) {
    if (imported.path.startsWith('.')) {
      continue;
    }
    const name = imported.path.startsWith('@')
      ? imported.path.split('/').slice(0, 2).join('/')
      : imported.path.split('/')[0];
    if (name !== packageJson.name && !(name in dependencies)) {
      throw new Error(`Undeclared runtime dependency: ${imported.path}`);
    }
  }
}

const dist = resolve(root, 'dist');
for (const relative of await readdir(dist, {recursive: true})) {
  if (!relative.endsWith('.js')) {
    continue;
  }
  const file = join(dist, relative);
  const javascript = await readFile(file, 'utf8');
  const fixed = javascript.replace(
    /((?:from\s*|import\s*\(\s*|import\s*)['"])(\.\.?\/[^'"]+)(['"])/g,
    (match, before, specifier, after) => {
      const target = resolve(dirname(file), specifier);
      if (existsSync(target + '.js')) {
        return `${before}${specifier}.js${after}`;
      }
      if (existsSync(join(target, 'index.js'))) {
        return `${before}${specifier}/index.js${after}`;
      }
      throw new Error(`Unresolved runtime import ${specifier} in ${relative}`);
    }
  );
  if (fixed !== javascript) {
    await writeFile(file, fixed);
  }
}

execFileSync(
  resolve(root, '../../node_modules/.bin/tsc'),
  ['--project', 'tsconfig.json'],
  {
    cwd: root,
    stdio: 'inherit',
  }
);
for (const relative of await readdir(dist, {recursive: true})) {
  if (!relative.endsWith('.d.ts')) {
    continue;
  }
  const file = join(dist, relative);
  const declaration = await readFile(file, 'utf8');
  const fixed = declaration.replace(
    /(['"])(\.\.?\/[^'"]+)\1/g,
    (match, quote, specifier) => {
      const target = resolve(dirname(file), specifier);
      if (existsSync(target + '.d.ts')) {
        return `${quote}${specifier}.js${quote}`;
      }
      if (existsSync(join(target, 'index.d.ts'))) {
        return `${quote}${specifier}/index.js${quote}`;
      }
      throw new Error(`Unresolved declaration import ${specifier} in ${relative}`);
    }
  );
  for (const [, specifier] of fixed.matchAll(
    /(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g
  )) {
    if (specifier.startsWith('.')) {
      continue;
    }
    const name = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0];
    if (name !== packageJson.name && !(name in dependencies)) {
      throw new Error(`Undeclared type dependency: ${specifier} in ${relative}`);
    }
  }
  if (fixed !== declaration) {
    await writeFile(file, fixed);
  }
}
console.log(`Built ${Object.keys(packageJson.exports).length} public entries.`);
