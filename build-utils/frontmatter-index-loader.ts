import fs from 'node:fs';
import path from 'node:path';

import type {LoaderDefinitionFunction} from '@rspack/core';
import {parse as parseYaml} from 'yaml';

const frontmatterIndexLoader: LoaderDefinitionFunction = function () {
  const staticAppDir = path.resolve(import.meta.dirname, '../static/app');

  this.addContextDependency(staticAppDir);

  const entries: Record<
    string,
    {category?: string; description?: string; title?: string}
  > = {};
  for (const relPath of fs.globSync('**/*.mdx', {cwd: staticAppDir})) {
    const absPath = path.join(staticAppDir, relPath);
    this.addDependency(absPath);

    const source = fs.readFileSync(absPath, 'utf8');
    const frontmatterBlock = source.match(/^---\s*\n([\s\S]*?)\n---/)?.[1];
    if (!frontmatterBlock) {
      continue;
    }

    const parsed = parseYaml(frontmatterBlock);
    if (!parsed || typeof parsed !== 'object') {
      continue;
    }

    const normalizedKey = 'app/' + relPath.replaceAll('\\', '/');
    entries[normalizedKey] = {
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
    };
  }

  return `export const storyFrontmatterIndex = ${JSON.stringify(entries, null, 2)};`;
};

export default frontmatterIndexLoader;
