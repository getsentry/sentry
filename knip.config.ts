import type {KnipConfig} from 'knip';

const config: KnipConfig = {
  entry: [
    // the main entry points - app, gsAdmin & gsApp
    'static/app/index.tsx!',
    'static/gsAdmin/index.tsx!',
    'static/gsApp/index.tsx!',
    // defined in webpack.config pipelines
    'static/app/utils/statics-setup.tsx!',
    'static/app/views/integrationPipeline/index.tsx!',
    // todo find out how chartcuterie works
    'static/app/chartcuterie/**/*.{js,ts,tsx}!',
    // stories are entries for storybook
    'static/app/**/*.stories.{js,ts,tsx}',
    // benchmarks are opt-in for development
    'static/app/**/*.benchmark.{js,ts,tsx}',
  ],
  project: [
    'static/app/**/*.{js,ts,tsx}!',
    'static/gsAdmin/**/*.{js,ts,tsx}!',
    'static/gsApp/**/*.{js,ts,tsx}!',
    'tests/js/**/*.{js,ts,tsx}',
    // exclude this directory because it's how you set up mocks in jest (https://jestjs.io/docs/manual-mocks)
    '!static/app/**/__mocks__/**',
    // fixtures can be ignored in production - it's fine that they are only used in tests
    '!static/app/**/fixtures/**!',
  ],
  rules: {
    binaries: 'off',
    dependencies: 'off',
    enumMembers: 'off',
    unlisted: 'off',
    unresolved: 'off',
  },
};

export default config;
