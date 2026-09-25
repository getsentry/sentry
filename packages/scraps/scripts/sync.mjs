import {cp, readFile, mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const packageRoot = new URL('../', import.meta.url);
const repositoryRoot = new URL('../../', packageRoot);
const manifest = JSON.parse(await readFile(new URL('entries.json', packageRoot), 'utf8'));
const generated = new URL('.generated/', packageRoot);

await rm(generated, {recursive: true, force: true});
await cp(new URL('src/', packageRoot), new URL('src/', generated), {recursive: true});

for (const [sourcePath, targetPath] of Object.entries(manifest.files)) {
  let source = await readFile(new URL(sourcePath, repositoryRoot), 'utf8');
  for (const [before, after] of Object.entries(manifest.imports)) {
    source = source.replaceAll(`'${before}'`, `'${after}'`);
  }
  if (/\b(?:from\s*|import\s*\()['"]sentry\//.test(source)) {
    throw new Error(`Sentry application import in ${sourcePath}`);
  }
  if (manifest.themeTypes.includes(targetPath)) {
    source = "import type {} from '@sentry/scraps/theme';\n" + source;
  }
  if (manifest.emotionJsx.includes(targetPath)) {
    source = '/** @jsxImportSource @emotion/react */\n' + source;
  }

  const target = new URL(targetPath, generated);
  await mkdir(dirname(fileURLToPath(target)), {recursive: true});
  await writeFile(target, source);
}

console.log(`Prepared ${Object.keys(manifest.files).length} Sentry sources.`);
