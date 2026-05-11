import type {KnipConfig} from 'knip';

const isProductionMode = process.argv.includes('--production');

const productionEntryPoints = [
  // the main entry points - app, gsAdmin & gsApp
  'static/app/index.tsx',
  // defined in rspack.config.ts pipelines
  'static/app/utils/statics-setup.tsx',
  // very dynamically imported
  'static/app/gettingStartedDocs/**/*.{js,ts,tsx}',
  // this is imported with require.context
  'static/app/data/forms/*.tsx',
  // frontend experiemnt framework may be unused when we have no experiemnets
  'static/app/utils/useExperiment.tsx',
  // --- we should be able to get rid of those: ---
  // Only used in stories (so far)
  'static/app/components/core/quote/*.tsx',
  // todo we currently keep all icons
  'static/app/icons/**/*.{js,ts,tsx}',
  // todo find out how chartcuterie works
  'static/app/chartcuterie/**/*.{js,ts,tsx}',
  // TODO: Remove when used
  'static/app/views/seerExplorer/contexts/**/*.{js,ts,tsx}',
  // TODO: Remove when integration into Explore has started
  'static/app/views/dashboards/widgets/heatMapWidget/**/*.{ts,tsx}',
];

const testingEntryPoints = [
  'static/**/*.spec.{js,ts,tsx}',
  'static/**/*.snapshots.tsx',
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
  'build-utils/mdx-plugins.ts',
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
  ignore: [
    // api-docs has its own package.json with its own dependencies
    'api-docs/**',
  ],
  ignoreExportsUsedInFile: isProductionMode,
  ignoreDependencies: [
    'core-js',
    'tslib', // subdependency of many packages, declare the latest version
    'buffer', // rspack.ProvidePlugin, needs better knip plugin
    'process', // rspack.ProvidePlugin, needs better knip plugin
    'odiff-bin', // raw binary consumed by Python backend, not a JS import
    '@swc-contrib/mut-cjs-exports', // used in jest config
  ],
  rules: {
    binaries: 'off',
    enumMembers: 'off',
  },
  include: ['nsExports', 'nsTypes'],
  mdx: {
    config: 'tsconfig.mdx.json',
  },
};

export default config;
