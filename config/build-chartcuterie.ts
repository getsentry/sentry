/* eslint-disable import/no-nodejs-modules, no-console */

import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {Configuration, SwcLoaderOptions} from '@rspack/core';
import rspack from '@rspack/core';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');
const entryPoint = path.join(workspaceRoot, 'static/app/chartcuterie/config.tsx');
const outDir = path.join(workspaceRoot, 'config/chartcuterie');
const outFile = path.join(outDir, 'config.js');
const staticPrefix = path.join(workspaceRoot, 'static');
const sentryDjangoAppPath = path.join(workspaceRoot, 'src/sentry/static/sentry');

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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

const swcLoaderConfig: SwcLoaderOptions = {
  jsc: {
    parser: {
      syntax: 'typescript',
      tsx: true,
    },
    transform: {
      react: {
        runtime: 'automatic',
        development: false,
      },
    },
  },
  isModule: 'unknown',
};

async function runRspack(commitHash: string): Promise<void> {
  const config: Configuration = {
    mode: 'production',
    target: 'node',
    entry: entryPoint,
    output: {
      path: outDir,
      filename: 'config.js',
      library: {
        type: 'commonjs2',
      },
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: /node_modules[\\/]core-js/,
          loader: 'builtin:swc-loader',
          options: swcLoaderConfig,
        },
        // Handle asset files - these should be tree-shaken, but rspack might
        // encounter them as we add and remove things from the dependency tree
        {
          test: /\.(svg|png|jpg|jpeg|gif|ico|webp|mp4|woff|woff2|ttf|eot)$/,
          type: 'asset/resource',
        },
        {
          test: /\.pegjs$/,
          type: 'asset/source',
        },
      ],
    },
    plugins: [
      // Exclude moment locales to reduce bundle size
      new rspack.IgnorePlugin({
        contextRegExp: /moment$/,
        resourceRegExp: /^\.\/locale$/,
      }),
      new rspack.DefinePlugin({
        'process.env.COMMIT_SHA': JSON.stringify(commitHash),
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.DEPLOY_PREVIEW_CONFIG': JSON.stringify(false),
        'process.env.EXPERIMENTAL_SPA': JSON.stringify(false),
        'process.env.IS_ACCEPTANCE_TEST': JSON.stringify(false),
        'process.env.USE_REACT_QUERY_DEVTOOL': JSON.stringify(false),
        'process.env.UI_DEV_ENABLE_PROFILING': JSON.stringify(false),
        'process.env.SPA_DSN': JSON.stringify(''),
        'process.env.SENTRY_RELEASE_VERSION': JSON.stringify(''),
      }),
    ],
    externals: [
      // Exclude CSS files from the bundle
      /\.css$/,
      /\.less$/,
    ],
    resolve: {
      alias: {
        sentry: path.join(staticPrefix, 'app'),
        'sentry-images': path.join(staticPrefix, 'images'),
        'sentry-logos': path.join(sentryDjangoAppPath, 'images', 'logos'),
        'sentry-fonts': path.join(staticPrefix, 'fonts'),
      },
      extensions: ['.js', '.tsx', '.ts', '.json'],
      preferAbsolute: true,
      modules: ['node_modules'],
    },
    optimization: {
      minimize: true,
      minimizer: [new rspack.SwcJsMinimizerRspackPlugin()],
      usedExports: true,
      sideEffects: true,
      providedExports: true,
      innerGraph: true,
    },
    // Suppress output except errors
    stats: 'errors-warnings',
  };

  return new Promise((resolve, reject) => {
    rspack.rspack(config, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }

      if (stats?.hasErrors()) {
        console.error(stats.toString({colors: true}));
        reject(new Error('Build failed with errors'));
        return;
      }

      if (stats?.hasWarnings()) {
        console.warn(stats.toString({colors: true, warnings: true}));
      }

      // Get the file size from stats
      const statsJson = stats?.toJson({assets: true});
      const mainAsset = statsJson?.assets?.find(asset => asset.name === 'config.js');
      const sizeStr = mainAsset ? ` (${formatFileSize(mainAsset.size)})` : '';

      console.info(`Chartcuterie config built successfully: ${outFile}${sizeStr}`);
      resolve();
    });
  });
}

async function buildChartcuterie() {
  let originalPackageJsonContent: string | null = null;
  let buildSuccess = false;

  try {
    const commitHash = getCommitHash();
    originalPackageJsonContent = await modifyPackageJsonSideEffects(); // Enable sideEffects: false
    await runRspack(commitHash);
    buildSuccess = true;
  } catch (error) {
    console.error('Build process failed:', error);
  } finally {
    await restorePackageJson(originalPackageJsonContent);
    process.exit(buildSuccess ? 0 : 1);
  }
}

buildChartcuterie();
