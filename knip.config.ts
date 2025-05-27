import {compile} from '@mdx-js/mdx';
import type {KnipConfig} from 'knip';

const productionEntryPoints = [
  // the main entry points - app, gsAdmin & gsApp
  'static/app/index.tsx',
  // dynamic imports _not_ recognized by knip
  'static/app/bootstrap/{index,initializeMain}.tsx',
  'static/gsApp/initializeBundleMetrics.tsx',
  // defined in webpack.config pipelines
  'static/app/utils/statics-setup.tsx',
  'static/app/views/integrationPipeline/index.tsx',
  // very dynamically imported
  'static/app/gettingStartedDocs/**/*.{js,mjs,ts,tsx}',
  // this is imported with require.context
  'static/app/data/forms/*.tsx',
  // --- we should be able to get rid of those: ---
  // todo codecov has unused code from the migration
  'static/app/{components,views}/codecov/**/*.{js,mjs,ts,tsx}',
  // todo we currently keep all icons
  'static/app/icons/**/*.{js,mjs,ts,tsx}',
  // todo find out how chartcuterie works
  'static/app/chartcuterie/**/*.{js,mjs,ts,tsx}',
];

const testingEntryPoints = [
  // benchmarks are opt-in for development
  'static/app/**/*.benchmark.{js,mjs,ts,tsx}',
  // jest uses this
  'tests/js/test-balancer/index.js',
];

const storyBookEntryPoints = [
  // our storybook implementation is here
  'static/app/stories/storyBook.tsx',
  // we have some stories in mdx format
  'static/app/**/*.mdx',
];

const config: KnipConfig = {
  entry: [
    ...productionEntryPoints.map(entry => `${entry}!`),
    ...testingEntryPoints,
    ...storyBookEntryPoints,
  ],
  storybook: true,
  project: [
    'static/**/*.{js,mjs,ts,tsx}!',
    'static/app/**/*.mdx',
    'tests/js/**/*.{js,mjs,ts,tsx}',
    // exclude this directory because it's how you set up mocks in jest (https://jestjs.io/docs/manual-mocks)
    '!static/{app,gsApp}/**/__mocks__/**',
    // fixtures can be ignored in production - it's fine that they are only used in tests
    '!static/**/{fixtures,__fixtures__}/**!',
    // helper files for tests - it's fine that they are only used in tests
    '!static/**/*{t,T}estUtils*.{js,mjs,ts,tsx}!',
    // helper files for stories - it's fine that they are only used in tests
    '!static/app/**/__stories__/*.{js,mjs,ts,tsx}!',
    '!static/app/stories/*.{js,mjs,ts,tsx}!',
  ],
  compilers: {
    mdx: async text => {
      const result = await compile(text, {
        providerImportSource: '@mdx-js/react',
        jsx: true,
        outputFormat: 'program',
      });

      return String(result);
    },
  },
  rules: {
    binaries: 'off',
    dependencies: 'off',
    enumMembers: 'off',
    unlisted: 'off',
    unresolved: 'off',
  },
};

export default config;
