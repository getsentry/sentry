#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parse} from '@babel/parser';
import traverse from '@babel/traverse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.join(REPO_ROOT, 'static', 'app');

function resolveImportPath(importPath, fromFile) {
  if (importPath.startsWith('.')) {
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);

    for (const ext of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return null;
  }

  if (importPath.startsWith('sentry/')) {
    const relativePath = importPath.replace(/^sentry\//, '');
    let resolved = path.join(APP_ROOT, relativePath);

    for (const ext of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return null;
  }

  if (importPath.startsWith('@sentry/scraps/')) {
    const relativePath = importPath.replace(/^@sentry\/scraps\//, 'components/core/');
    let resolved = path.join(APP_ROOT, relativePath);

    for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  return null;
}

const searchBarPath = path.join(APP_ROOT, 'components', 'searchBar', 'index.tsx');

console.log('Checking SearchBar imports...\n');
console.log('SearchBar path:', searchBarPath);
console.log('Exists:', fs.existsSync(searchBarPath));

// Test resolution
const testImport = 'sentry/components/searchBar';
const resolved = resolveImportPath(testImport, path.join(APP_ROOT, 'test.tsx'));
console.log(`\nResolving "${testImport}":`, resolved);
console.log('Matches SearchBar:', resolved === searchBarPath);

// Check a file that imports SearchBar
const testFile = path.join(APP_ROOT, 'components', 'platformPicker.tsx');
if (fs.existsSync(testFile)) {
  console.log(`\nChecking imports in platformPicker.tsx...`);

  const content = fs.readFileSync(testFile, 'utf-8');
  const ast = parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  traverse.default(ast, {
    ImportDeclaration(nodePath) {
      if (nodePath.node.source.value.includes('searchBar')) {
        console.log('  Import:', nodePath.node.source.value);
        const resolved = resolveImportPath(nodePath.node.source.value, testFile);
        console.log('  Resolved to:', resolved);
        console.log('  Matches:', resolved === searchBarPath);
      }
    },
  });
}
