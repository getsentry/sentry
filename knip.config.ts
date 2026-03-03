import {compile} from '@mdx-js/mdx';
import type {KnipConfig} from 'knip';

const isProductionMode = process.argv.includes('--production');

const productionEntryPoints = [
  // the main entry points - app, gsAdmin & gsApp
  'static/app/index.tsx',
  // defined in rspack.config.ts pipelines
  'static/app/utils/statics-setup.tsx',
  'static/app/views/integrationPipeline/index.tsx',
  // very dynamically imported
  'static/app/gettingStartedDocs/**/*.{js,ts,tsx}',
  // this is imported with require.context
  'static/app/data/forms/*.tsx',
  // --- we should be able to get rid of those: ---
  // Only used in stories (so far)
  'static/app/components/core/quote/*.tsx',
  // Prevent exception until we build out coverage
  'static/app/components/prevent/virtualRenderers/**/*.{js,ts,tsx}',
  // Temporary Prevent TA exceptions until the code is removed
  'static/app/views/nav/secondary/sections/prevent/**/*.{js,ts,tsx}',
  'static/app/views/prevent/**/*.{js,ts,tsx}',
  // todo we currently keep all icons
  'static/app/icons/**/*.{js,ts,tsx}',
  // todo find out how chartcuterie works
  'static/app/chartcuterie/**/*.{js,ts,tsx}',
];

const testingEntryPoints = [
  'static/**/*.spec.{js,ts,tsx}',
  'tests/js/**/*.spec.{js,ts,tsx}',
  // jest uses this
  'tests/js/test-balancer/index.js',
];

const storyBookEntryPoints = [
  // our storybook implementation is here
  'static/app/stories/storybook.tsx',
  'static/app/stories/playground/*.tsx',
  'static/**/*.stories.{js,ts,tsx}',
  'static/**/*.mdx',
];

const config: KnipConfig = {
  entry: [
    ...productionEntryPoints.map(entry => `${entry}!`),
    ...testingEntryPoints,
    ...storyBookEntryPoints,
    'static/eslint/**/index.ts',
    // figma code connect files - consumed by Figma CLI
    'static/**/*.figma.{tsx,jsx}',
  ],
  project: [
    'static/**/*.{js,ts,tsx}!',
    'config/**/*.ts',
    'tests/js/**/*.{js,ts,tsx}',
    // fixtures can be ignored in production - it's fine that they are only used in tests
    '!static/**/{fixtures,__fixtures__}/**!',
    // helper files for tests - it's fine that they are only used in tests
    '!static/**/*{t,T}estUtils*.{js,ts,tsx}!',
    // helper files for stories - it's fine that they are only used in tests
    '!static/app/**/__stories__/*.{js,ts,tsx}!',
    '!static/app/stories/**/*.{js,ts,tsx}!',
    // ignore eslint plugins in production
    '!static/eslint/**/*.ts!',
  ],
  compilers: {
    mdx: async text => String(await compile(text)),
  },
  ignoreExportsUsedInFile: isProductionMode,
  ignoreDependencies: [
    'core-js',
    'jest-environment-jsdom', // used as testEnvironment in jest config
    'swc-plugin-component-annotate', // used in rspack config, needs better knip plugin
    '@swc/plugin-emotion', // used in rspack config, needs better knip plugin
    'buffer', // rspack.ProvidePlugin, needs better knip plugin
    'process', // rspack.ProvidePlugin, needs better knip plugin
    '@types/webpack-env', // needed to make require.context work
    '@types/gtag.js', // needed for global `gtag` namespace typings
    '@babel/preset-env', // Still used in jest
    '@babel/preset-react', // Still used in jest
    '@babel/preset-typescript', // Still used in jest
    '@emotion/babel-plugin', // Still used in jest
    'odiff-bin', // raw binary consumed by Python backend, not a JS import
  ],
  rules: {
    binaries: 'off',
    enumMembers: 'off',
    unlisted: 'off',
  },
  include: ['nsExports', 'nsTypes'],
};

export default config;
