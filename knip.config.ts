import type {KnipConfig} from 'knip';

const isProductionMode = process.argv.includes('--production');

const productionEntryPoints = [
  // the main entry points - app, gsAdmin & gsApp
  'static/app/index.tsx',
  // scraps has all index.tsx file as separate entry points
  'static/app/components/core/*/index.tsx',
  // defined in rspack.config.ts pipelines
  'static/app/utils/setupStatics.tsx',
  'static/app/serviceWorker/worker/worker.ts',
  // scripts are entry points
  'scripts/*.ts',
  // very dynamically imported
  'static/app/gettingStartedDocs/**/*.{js,ts,tsx}',
  // --- we should be able to get rid of those: ---
  // TODO: Remove when wired into Seer Explorer
  'static/app/components/core/chat/thinkingBlock.tsx',
  'static/app/components/core/chat/toolCall.tsx',
  // todo we currently keep all icons
  'static/app/icons/**/*.{js,ts,tsx}',
  // todo find out how chartcuterie works
  'static/app/chartcuterie/**/*.{js,ts,tsx}',
  // TODO: Remove when the autofixRef embed consumes it (#122099)
  'static/app/components/seer/autofixChatContext.tsx',
  'static/app/components/brandPageLayout/**/*.{ts,tsx}',
  // React authentication routes are discovered dynamically by the frontend route registry
  'static/app/views/authV2/authLogin/**/*.{ts,tsx}',
];

const testingEntryPoints = [
  'static/**/*.spec.{js,ts,tsx}',
  'static/**/*.snapshots.tsx',
  'tests/js/**/*.spec.{js,ts,tsx}',
  'tests/js/test-balancer/*.ts',
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
  workspaces: {
    '.': {
      entry: [
        ...productionEntryPoints.map(entry => `${entry}!`),
        ...testingEntryPoints,
        ...storyBookEntryPoints,
        // figma code connect files - consumed by Figma CLI
        'static/**/*.figma.{tsx,jsx}',
      ],
      project: [
        'static/**/*.{js,ts,tsx,mdx,less}!',
        'config/**/*.ts',
        'tests/js/**/*.{js,ts,tsx}',
        // fixtures can be ignored in production - it's fine that they are only used in tests
        '!static/**/{fixtures,__fixtures__}/**!',
        // helper files for tests - it's fine that they are only used in tests
        '!static/**/*{t,T}estUtils*.{js,ts,tsx}!',
        // helper files for stories - it's fine that they are only used in tests
        '!static/app/**/__stories__/*.{js,ts,tsx}!',
        '!static/app/stories/**/*.{js,ts,tsx}!',
        // eslint plugins are separate workspace packages
        '!static/eslint/**/*.ts!',
      ],
      ignoreDependencies: [
        'core-js',
        'tslib', // subdependency of many packages, declare the latest version
        'odiff-bin', // raw binary consumed by Python backend, not a JS import
        'run-on-changed', // CLI used by the eslint CI job (.github/workflows/frontend.yml), not a JS import
        '@swc-contrib/mut-cjs-exports', // used in jest config
      ],
      // Knip's Less compiler expects the extension in `project`; styles are handled by Rspack,
      // so do not report them as unused files.
      ignoreFiles: ['static/**/*.less'],
    },
    'static/eslint/eslintPluginSentry': {
      // RuleTester resolves these cross-file fixtures by filename.
      ignoreFiles: ['fixtures/**/*.{ts,tsx}'],
    },
  },
  ignoreExportsUsedInFile: isProductionMode,
  rules: {
    binaries: 'off',
    enumMembers: 'off',
  },
  include: ['nsExports', 'nsTypes'],
  mdx: {
    config: 'tsconfig.mdx.json',
  },
  treatConfigHintsAsErrors: true,
  treatTagHintsAsErrors: true,
};

export default config;
