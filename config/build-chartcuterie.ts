/* eslint-disable import/no-nodejs-modules, no-console */

import * as esbuild from 'esbuild';
import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');
const entryPoint = path.join(workspaceRoot, 'static/app/chartcuterie/config.tsx');
const outfile = path.join(workspaceRoot, 'config/chartcuterie/config.js');

/**
 * Reads package.json, modifies the sideEffects property, and writes it back.
 * Returns the original content of package.json before modification.
 *
 * We don't need side effects because we're only interested in the config being exported.
 * Allowing side effects would mean keeping more files in the bundle.
 */
async function modifyPackageJsonSideEffects(): Promise<string> {
  const originalContent = await fs.readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(originalContent);

  if (packageJson.sideEffects !== false) {
    // Adding side effects false improves tree shaking and removes an additional 1mb
    packageJson.sideEffects = false;
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  return originalContent;
}

async function restorePackageJson(originalContent: string | null) {
  if (originalContent === null) {
    return;
  }
  try {
    const currentContent = await fs.readFile(packageJsonPath, 'utf-8');
    if (currentContent !== originalContent) {
      await fs.writeFile(packageJsonPath, originalContent);
    }
  } catch (restoreError) {
    console.error('Failed to restore package.json!', restoreError);
    process.exit(2);
  }
}

function getCommitHash(): string {
  return (
    process.env.SENTRY_BUILD ||
    childProcess.execSync('git rev-parse HEAD').toString().trim()
  );
}

async function runEsbuild(commitHash: string): Promise<void> {
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    outfile,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    define: {
      'process.env.COMMIT_SHA': JSON.stringify(commitHash),
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.DEPLOY_PREVIEW_CONFIG': JSON.stringify(false),
      'process.env.EXPERIMENTAL_SPA': JSON.stringify(false),
      'process.env.IS_ACCEPTANCE_TEST': JSON.stringify(false),
      'process.env.USE_REACT_QUERY_DEVTOOL': JSON.stringify(false),
      'process.env.UI_DEV_ENABLE_PROFILING': JSON.stringify(false),
      'process.env.SPA_DSN': JSON.stringify(''),
      'process.env.SENTRY_RELEASE_VERSION': JSON.stringify(''),
    },
    minify: false,
    treeShaking: true,
    logLevel: 'info',
  });
}

async function buildChartcuterie() {
  let originalPackageJsonContent: string | null = null;
  let esbuildSuccess = false;

  try {
    const commitHash = getCommitHash();
    originalPackageJsonContent = await modifyPackageJsonSideEffects(); // Enable sideEffects: false
    await runEsbuild(commitHash);
    esbuildSuccess = true;
  } catch (error) {
    console.error('Build process failed:', error);
  } finally {
    await restorePackageJson(originalPackageJsonContent);
    process.exit(esbuildSuccess ? 0 : 1);
  }
}

buildChartcuterie();
