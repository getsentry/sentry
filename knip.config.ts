import type {KnipConfig} from 'knip';

const isProductionMode = process.argv.includes('--production');

const productionEntryPoints = [
  // scraps has all index.tsx file as separate entry points
  'components/core/*/index.tsx',
  // Build entry points that are not package entry points.
  'utils/setupStatics.tsx',
  'serviceWorker/worker/worker.ts',
  // Source-scoped Rspack/Jest aliases use this runtime entry; TS uses types.d.ts.
  'utils/reactRouterV6/index.ts',
  // very dynamically imported
  'gettingStartedDocs/**/*.{js,ts,tsx}',
  // --- we should be able to get rid of those: ---
  // TODO: Remove when wired into Seer Explorer
  'components/core/chat/thinkingBlock.tsx',
  'components/core/chat/toolCall.tsx',
  // todo find out how chartcuterie works
  'chartcuterie/**/*.{js,ts,tsx}',
  // TODO: Remove when the autofixRef embed consumes it (#122099)
  'components/seer/autofixChatContext.tsx',
  'components/brandPageLayout/**/*.{ts,tsx}',
  // React authentication routes are discovered dynamically by the frontend route registry
  'views/authV2/authLogin/**/*.{ts,tsx}',
  // OAuth infrastructure is introduced before the route entry points.
  'views/authV2/oauth{,Authorize,Device}/**/*.{ts,tsx}',
];

// Scoped configs reuse the test package's dependencies. Parse the shared config
// in its owning workspace, and treat each wrapper as a development entry.
const scopedJest = {
  config: [],
  entry: ['jest.config.mjs', '**/*.{spec,test}.{js,ts,tsx}'],
};

const frontendWorkspace = {
  jest: scopedJest,
  // SWC injects these imports while compiling each app package.
  ignoreDependencies: ['core-js'],
  entry: ['**/*.{spec,test}.{js,ts,tsx}'],
  project: [
    '**/*.{js,ts,tsx,mdx}!',
    // fixtures and helpers are only used in tests and stories
    '!**/{fixtures,__fixtures__}/**!',
    '!**/*{t,T}estUtils*.{js,ts,tsx}!',
    '!**/__stories__/*.{js,ts,tsx}!',
    '!stories/**/*.{js,ts,tsx}!',
  ],
};

const config: KnipConfig = {
  // MDX tooling is declared at the root, but stories belong to the app workspace.
  compilers: {mdx: true},
  // Test package exports are development entry points, not production code.
  ignoreWorkspaces: ['tests/js!', 'tests/js/getsentry-test!'],
  workspaces: {
    '.': {
      // The root runs app tests, but Jest is declared in the test package.
      jest: {config: 'tests/js/jest.config.ci.mjs'},
      entry: ['scripts/*.ts!', 'build-utils/mdx-plugins.ts'],
      project: [
        'static/**/*.{js,ts,tsx,mdx,less}!',
        'config/**/*.ts',
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
        'react-router-v8', // Knip cannot trace the conditional Rspack package alias.
        'tslib', // subdependency of many packages, declare the latest version
        'odiff-bin', // raw binary consumed by Python backend, not a JS import
        'zrender', // used in echarts
        // Referenced by its node_modules path in tests/js/createJestConfig.ts.
        'reflux',
      ],
      // Knip's Less compiler expects the extension in `project`; styles are handled by Rspack,
      // so do not report them as unused files.
      ignoreFiles: ['static/**/*.less'],
    },
    'static/app': {
      ...frontendWorkspace,
      // Locale modules are loaded with a template-string import.
      ignoreDependencies: [
        ...frontendWorkspace.ignoreDependencies,
        'moment',
        '@figma/code-connect', // Figma mappings are parsed by the CLI via pnpm dlx.
      ],
      entry: [
        ...productionEntryPoints.map(entry => `${entry}!`),
        ...frontendWorkspace.entry,
        '**/__mocks__/**/*.{js,ts,tsx}',
        '**/*.snapshots.tsx',
        '**/*.stories.{js,ts,tsx}',
        '**/*.mdx',
        // figma code connect files - consumed by Figma CLI
        '**/*.figma.{tsx,jsx}',
        'stories/storybook.tsx',
        'stories/playground/*.tsx',
      ],
    },
    'static/gsApp': {
      ...frontendWorkspace,
      entry: [
        ...frontendWorkspace.entry,
        '**/*.snapshots.tsx',
        '**/__mocks__/**/*.{js,ts,tsx}',
      ],
    },
    'static/gsAdmin': {
      ...frontendWorkspace,
    },
    'tests/js': {
      jest: {
        config: ['jest.config.mjs', 'jest.config.ci.mjs', 'jest.config.snapshots.ts'],
      },
      entry: ['**/*.spec.{js,ts,tsx}', 'test-balancer/*.ts'],
      project: ['**/*.{js,cjs,mjs,ts,tsx,mdx}'],
      includeEntryExports: true,
      ignoreDependencies: [
        '@sentry-internal/global-search', // jest.mock does not count as an import.
        '@tanstack/react-pacer', // loaded with requireActual
        'echarts-for-react', // jest.mock in setup.ts
      ],
    },
    'tests/js/getsentry-test': {
      project: ['**/*.{js,ts,tsx,mdx}'],
      includeEntryExports: true,
      ignoreDependencies: [
        'react', // loaded with jest.requireActual, which Knip does not track.
        '@stripe/react-stripe-js', // Billing setup mocks this package; Knip does not track jest.mock.
        '@stripe/stripe-js', // Billing setup mocks this package; Knip does not track jest.mock.
      ],
    },
    'static/packages/icons': {
      // test helpers are only used outside production.
      project: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx,mdx}!', '!test/**!'],
      includeEntryExports: true,
    },
    'static/packages/scraps': {
      project: [
        '**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx,mdx}!',
        // Test helpers and package verification scripts are not production code.
        '!{test,scripts}/**!',
      ],
    },
    'static/oxlint/eslintPluginScraps': {
      jest: scopedJest,
    },
    'static/oxlint/eslintPluginSentry': {
      jest: scopedJest,
      // RuleTester resolves these cross-file fixtures by filename.
      ignoreFiles: ['fixtures/**/*.{ts,tsx}'],
    },
  },
  ignoreExportsUsedInFile: isProductionMode,
  cycles: {
    dynamicImports: false,
  },
  rules: {
    binaries: 'off',
    enumMembers: 'off',
    cycles: 'error',
  },
  include: ['nsExports', 'nsTypes'],
  mdx: {
    config: 'tsconfig.mdx.json',
  },
  treatConfigHintsAsErrors: true,
  treatTagHintsAsErrors: true,
};

export default config;
