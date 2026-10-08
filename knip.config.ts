import type {KnipConfig} from 'knip';

const isProductionMode = process.argv.includes('--production');

const productionEntryPoints = [
  // the main entry point also loads gsAdmin & gsApp
  'index.tsx',
  // scraps has all index.tsx file as separate entry points
  'components/core/*/index.tsx',
  // defined in rsbuild.config.ts pipelines
  'utils/setupStatics.tsx',
  // Source-scoped Rspack/Jest aliases use this runtime entry; TS uses types.d.ts.
  'utils/reactRouterV6/index.ts',
  'serviceWorker/worker/worker.ts',
  // very dynamically imported
  'gettingStartedDocs/**/*.{js,ts,tsx}',
  // --- we should be able to get rid of those: ---
  // TODO: Remove when wired into Seer Explorer
  'components/core/chat/thinkingBlock.tsx',
  'components/core/chat/toolCall.tsx',
  // todo we currently keep all icons
  'icons/**/*.{js,ts,tsx}',
  // todo find out how chartcuterie works
  'chartcuterie/**/*.{js,ts,tsx}',
  // TODO: Remove when the autofixRef embed consumes it (#122099)
  'components/seer/autofixChatContext.tsx',
  'components/brandPageLayout/**/*.{ts,tsx}',
  // React authentication routes are discovered dynamically by the frontend route registry
  'views/authV2/authLogin/**/*.{ts,tsx}',
];

const frontendWorkspace = {
  entry: [
    '**/*.spec.{js,ts,tsx}',
    '**/*.snapshots.tsx',
    '**/*.stories.{js,ts,tsx}',
    '**/*.mdx',
    // figma code connect files - consumed by Figma CLI
    '**/*.figma.{tsx,jsx}',
  ],
  project: [
    '**/*.{js,ts,tsx,mdx,less}!',
    // fixtures and helpers are only used in tests and stories
    '!**/{fixtures,__fixtures__}/**!',
    '!**/*{t,T}estUtils*.{js,ts,tsx}!',
    '!**/__stories__/*.{js,ts,tsx}!',
    '!stories/**/*.{js,ts,tsx}!',
  ],
  // Styles are handled by Rspack, so do not report them as unused files.
  ignoreFiles: ['**/*.less'],
};

const config: KnipConfig = {
  // These packages have their own TypeScript configurations and test suites.
  ignoreWorkspaces: ['static/packages/scraps', 'static/packages/icons'],
  workspaces: {
    '.': {
      entry: [
        'scripts/*.ts!',
        'tests/js/**/*.spec.{js,ts,tsx}',
        'tests/js/test-balancer/*.ts',
        'build-utils/mdx-plugins.ts',
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
        // Oxlint JS plugins are separate workspace packages
        '!static/oxlint/**/*.ts!',
      ],
      ignoreDependencies: [
        'tslib', // subdependency of many packages, declare the latest version
        'odiff-bin', // raw binary consumed by Python backend, not a JS import
        '@swc-contrib/mut-cjs-exports', // used in jest config
        'zrender', // used in echarts
        // Knip does not count jest.mock/requireActual calls in tests/js/setup.ts.
        '@sentry-internal/global-search',
        '@stripe/react-stripe-js',
        '@stripe/stripe-js',
        '@tanstack/react-pacer',
        'echarts-for-react',
        // Referenced by its node_modules path in jest.config.ts.
        'reflux',
      ],
      // Knip's Less compiler expects the extension in `project`; styles are handled by Rspack,
      // so do not report them as unused files.
      ignoreFiles: ['static/**/*.less'],
    },
    'static/app': {
      ...frontendWorkspace,
      entry: [
        ...productionEntryPoints.map(entry => `${entry}!`),
        ...frontendWorkspace.entry,
        'stories/storybook.tsx',
        'stories/playground/*.tsx',
      ],
    },
    'static/gsApp': frontendWorkspace,
    'static/gsAdmin': frontendWorkspace,
    'static/oxlint/eslintPluginSentry': {
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
