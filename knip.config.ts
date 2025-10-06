import {compile} from '@mdx-js/mdx';
import type {KnipConfig} from 'knip';

const isProductionMode = process.argv.includes('--production');

const productionEntryPoints = [
  // the main entry points - app, gsAdmin & gsApp
  'static/app/index.tsx',
  // dynamic imports _not_ recognized by knip
  'static/app/bootstrap/initializeMain.tsx',
  'static/gsApp/initializeBundleMetrics.tsx',
  // defined in webpack.config pipelines
  'static/app/utils/statics-setup.tsx',
  'static/app/views/integrationPipeline/index.tsx',
  // very dynamically imported
  'static/app/gettingStartedDocs/**/*.{js,mjs,ts,tsx}',
  // this is imported with require.context
  'static/app/data/forms/*.tsx',
  // --- we should be able to get rid of those: ---
  // Prevent exception until we build out coverage
  'static/app/components/prevent/virtualRenderers/**/*.{js,ts,tsx}',
  // todo we currently keep all icons
  'static/app/icons/**/*.{js,mjs,ts,tsx}',
  // todo find out how chartcuterie works
  'static/app/chartcuterie/**/*.{js,mjs,ts,tsx}',
];

const testingEntryPoints = [
  'static/**/*.spec.{js,mjs,ts,tsx}',
  'tests/js/**/*.spec.{js,mjs,ts,tsx}',
  // jest uses this
  'tests/js/test-balancer/index.js',
];

const storyBookEntryPoints = [
  // our storybook implementation is here
  'static/app/stories/storybook.tsx',
  'static/**/*.stories.{js,mjs,ts,tsx}',
  'static/**/*.mdx',
];

const config: KnipConfig = {
  entry: [
    ...productionEntryPoints.map(entry => `${entry}!`),
    ...testingEntryPoints,
    ...storyBookEntryPoints,
  ],
  project: [
    'static/**/*.{js,mjs,ts,tsx}!',
    'config/**/*.ts',
    'tests/js/**/*.{js,mjs,ts,tsx}',
    // fixtures can be ignored in production - it's fine that they are only used in tests
    '!static/**/{fixtures,__fixtures__}/**!',
    // helper files for tests - it's fine that they are only used in tests
    '!static/**/*{t,T}estUtils*.{js,mjs,ts,tsx}!',
    // helper files for stories - it's fine that they are only used in tests
    '!static/app/**/__stories__/*.{js,mjs,ts,tsx}!',
    '!static/app/stories/**/*.{js,mjs,ts,tsx}!',
    // TEMPORARY! Abdullah Khan: WILL BE REMOVING IN STACKED PRs. Trying to merge PRs in smaller batches.
    '!static/app/views/performance/newTraceDetails/traceModels/traceTreeNode/**/*.{js,mjs,ts,tsx}!',
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
  ],
  rules: {
    binaries: 'off',
    enumMembers: 'off',
    unlisted: 'off',
  },
  include: ['nsExports', 'nsTypes'],
};

export default config;
