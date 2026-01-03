/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

import remarkCallout, {type Callout} from '@r4ai/remark-callout';
import {RsdoctorRspackPlugin} from '@rsdoctor/rspack-plugin';
import type {
  Configuration,
  DevServer,
  OptimizationSplitChunksCacheGroup,
  SwcLoaderOptions,
} from '@rspack/core';
import rspack from '@rspack/core';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';
import {sentryWebpackPlugin} from '@sentry/webpack-plugin/webpack5';
import CompressionPlugin from 'compression-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import rehypeExpressiveCode from 'rehype-expressive-code';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import {TsCheckerRspackPlugin} from 'ts-checker-rspack-plugin';

// @ts-expect-error: ts(5097) importing `.ts` extension is required for resolution, but not enabled until `allowImportingTsExtensions` is added to tsconfig
import LastBuiltPlugin from './build-utils/last-built-plugin.ts';
// @ts-expect-error: ts(5097) importing `.ts` extension is required for resolution, but not enabled until `allowImportingTsExtensions` is added to tsconfig
import {remarkUnwrapMdxParagraphs} from './build-utils/remark-unwrap-mdx-paragraphs.ts';
import packageJson from './package.json' with {type: 'json'};

const {env} = process;

// Environment configuration
env.NODE_ENV = env.NODE_ENV ?? 'development';
const IS_PRODUCTION = env.NODE_ENV === 'production';
const IS_TEST = env.NODE_ENV === 'test' || !!env.TEST_SUITE;

// This is used to stop rendering dynamic content for tests/snapshots
// We want it in the case where we are running tests and it is in CI,
// this should not happen in local
const IS_CI = !!env.CI;

// We intentionally build in production mode for acceptance tests, so we explicitly use an env var to
// say that the bundle will be used in acceptance tests. This affects webpack plugins and components
// with dynamic data that render differently statically in tests.
//
// Note, cannot assume it is an acceptance test if `IS_CI` is true, as our image builds has the
// `CI` env var set.
const IS_ACCEPTANCE_TEST = !!env.IS_ACCEPTANCE_TEST;
const IS_DEPLOY_PREVIEW = !!env.NOW_GITHUB_DEPLOYMENT;

const IS_UI_DEV_ONLY = !!env.SENTRY_UI_DEV_ONLY;
const IS_ADMIN_UI_DEV = !!env.SENTRY_ADMIN_UI_DEV;

const DEV_MODE = !(IS_PRODUCTION || IS_CI);
const WEBPACK_MODE: Configuration['mode'] = IS_PRODUCTION ? 'production' : 'development';
const CONTROL_SILO_PORT = env.SENTRY_CONTROL_SILO_PORT;

// Sentry Developer Tool flags. These flags are used to enable / disable different developer tool
// features in the Sentry UI.
// React query devtools are disabled by default, but can be enabled by setting the USE_REACT_QUERY_DEVTOOL env var to 'true'
const USE_REACT_QUERY_DEVTOOL = !!env.USE_REACT_QUERY_DEVTOOL;
// Sentry toolbar is enabled by default, but can be disabled by setting the DISABLE_SENTRY_TOOLBAR env var to 'true'
const ENABLE_SENTRY_TOOLBAR =
  env.ENABLE_SENTRY_TOOLBAR === undefined
    ? true
    : Boolean(JSON.parse(env.ENABLE_SENTRY_TOOLBAR));

// Environment variables that are used by other tooling and should
// not be user configurable.
//
// Ports used by webpack dev server to proxy to backend and webpack
const SENTRY_BACKEND_PORT = env.SENTRY_BACKEND_PORT;
const SENTRY_WEBPACK_PROXY_HOST = env.SENTRY_WEBPACK_PROXY_HOST;
const SENTRY_WEBPACK_PROXY_PORT = env.SENTRY_WEBPACK_PROXY_PORT;
const SENTRY_RELEASE_VERSION = env.SENTRY_RELEASE_VERSION;

// Used by sentry devserver runner to force using webpack-dev-server
const FORCE_WEBPACK_DEV_SERVER = !!env.FORCE_WEBPACK_DEV_SERVER;
const HAS_WEBPACK_DEV_SERVER_CONFIG =
  !!SENTRY_BACKEND_PORT && !!SENTRY_WEBPACK_PROXY_PORT;

// User/tooling configurable environment variables
const NO_DEV_SERVER = !!env.NO_DEV_SERVER; // Do not run webpack dev server
const SHOULD_FORK_TS = DEV_MODE && !env.NO_TS_FORK; // Do not run fork-ts plugin (or if not dev env)
const SHOULD_HOT_MODULE_RELOAD = DEV_MODE && !!env.SENTRY_UI_HOT_RELOAD;
const SHOULD_ADD_RSDOCTOR = Boolean(env.RSDOCTOR);

// Deploy previews are built using vercel. We can check if we're in vercel's
// build process by checking the existence of the PULL_REQUEST env var.
const DEPLOY_PREVIEW_CONFIG = IS_DEPLOY_PREVIEW && {
  branch: env.NOW_GITHUB_COMMIT_REF,
  commitSha: env.NOW_GITHUB_COMMIT_SHA,
  githubOrg: env.NOW_GITHUB_COMMIT_ORG,
  githubRepo: env.NOW_GITHUB_COMMIT_REPO,
};

const require = createRequire(import.meta.url);

// When deploy previews are enabled always enable experimental SPA mode --
// deploy previews are served standalone. Otherwise fallback to the environment
// configuration.
const SENTRY_EXPERIMENTAL_SPA =
  !DEPLOY_PREVIEW_CONFIG && !IS_UI_DEV_ONLY ? !!env.SENTRY_EXPERIMENTAL_SPA : true;

// We should only read from the SENTRY_SPA_DSN env variable if SENTRY_EXPERIMENTAL_SPA
// is true. This is to make sure we can validate that the experimental SPA mode is
// working properly.
const SENTRY_SPA_DSN = SENTRY_EXPERIMENTAL_SPA ? env.SENTRY_SPA_DSN : undefined;
const CODECOV_TOKEN = env.CODECOV_TOKEN;
// value should come back as either 'true' or 'false' or undefined
const ENABLE_CODECOV_BA = env.CODECOV_ENABLE_BA === 'true';

// this is the path to the django "sentry" app, we output the webpack build here to `dist`
// so that `django collectstatic` and so that we can serve the post-webpack bundles
const sentryDjangoAppPath = path.join(import.meta.dirname, 'src/sentry/static/sentry');
const distPath = path.join(sentryDjangoAppPath, 'dist');
const staticPrefix = path.join(import.meta.dirname, 'static');

// Locale compilation and optimizations.
//
// Locales are code-split from the app and vendor chunk into separate chunks
// that will be loaded by layout.html depending on the users configured locale.
//
// Code splitting happens using the splitChunks plugin, configured under the
// `optimization` key of the webpack module. We create chunk (cache) groups for
// each of our supported locales and extract the PO files and moment.js locale
// files into each chunk.
//
// A plugin is used to remove the locale chunks from the app entry's chunk
// dependency list, so that our compiled bundle does not expect that *all*
// locale chunks must be loaded
const localeCatalogPath = path.join(
  import.meta.dirname,
  'src',
  'sentry',
  'locale',
  'catalogs.json'
);

type LocaleCatalog = {
  supported_locales: string[];
};

const localeCatalog: LocaleCatalog = JSON.parse(
  fs.readFileSync(localeCatalogPath, 'utf8')
);

// Translates a locale name to a language code.
//
// * po files are kept in a directory represented by the locale name [0]
// * moment.js locales are stored as language code files
//
// [0] https://docs.djangoproject.com/en/2.1/topics/i18n/#term-locale-name
const localeToLanguage = (locale: string) => locale.toLowerCase().replace('_', '-');
const supportedLocales = localeCatalog.supported_locales;
const supportedLanguages = supportedLocales.map(localeToLanguage);

// A mapping of chunk groups used for locale code splitting
const localeChunkGroups: Record<string, OptimizationSplitChunksCacheGroup> = {};

for (const locale of supportedLocales) {
  // No need to split the english locale out as it will be completely empty and
  // is not included in the django layout.html.
  if (locale === 'en') {
    continue;
  }

  const language = localeToLanguage(locale);
  const group = `locale/${language}`;

  // We are defining a chunk that combines the django language files with
  // moment's locales as if you want one, you will want the other.
  //
  // In the application code you will still need to import via their module
  // paths and not the chunk name
  localeChunkGroups[group] = {
    chunks: 'async',
    name: group,
    test: new RegExp(
      `(locale\\/${locale}\\/.*\\.po$)|(moment\\/locale\\/${language}\\.js$)`
    ),
    enforce: true,
  };
}

const swcReactLoaderConfig: SwcLoaderOptions = {
  env: {
    mode: 'usage',
    // https://rspack.rs/guide/features/builtin-swc-loader#polyfill-injection
    coreJs: '3.45.0',
    targets: packageJson.browserslist.production,
    shippedProposals: true,
  },
  jsc: {
    experimental: {
      plugins: [
        [
          '@swc/plugin-emotion',
          {
            sourceMap: true,
            // The "dev-only" option does not seem to apply correctly
            autoLabel: DEV_MODE ? 'always' : 'never',
          },
        ],
        [
          'swc-plugin-component-annotate',
          Object.assign(
            {},
            {
              'annotate-fragments': false,
              'component-attr': 'data-sentry-component',
              'element-attr': 'data-sentry-element',
              'source-file-attr': 'data-sentry-source-file',
              experimental_rewrite_emotion_styled: process.env.NODE_ENV === 'development',
            },
            // We don't want to add source path attributes in production
            // as it will unnecessarily bloat the bundle size
            IS_PRODUCTION
              ? {}
              : {
                  'source-path-attr': 'data-sentry-source-path',
                }
          ),
        ],
      ],
    },
    parser: {
      syntax: 'typescript',
      tsx: true,
    },
    transform: {
      react: {
        runtime: 'automatic',
        development: DEV_MODE,
        refresh: SHOULD_HOT_MODULE_RELOAD,
        importSource: '@emotion/react',
      },
    },
  },
  isModule: 'unknown',
};

/**
 * Main Webpack config for Sentry React SPA.
 */

const appConfig: Configuration = {
  mode: WEBPACK_MODE,
  target: 'browserslist',
  // Fail on first error instead of continuing to build
  // https://rspack.rs/config/other-options#bail
  bail: IS_PRODUCTION,
  entry: {
    /**
     * Main Sentry SPA
     *
     * The order here matters for `getsentry`
     */
    app: ['sentry/utils/statics-setup', 'sentry'],

    /**
     * Pipeline View for integrations
     */
    pipeline: ['sentry/utils/statics-setup', 'sentry/views/integrationPipeline'],

    // admin interface
    gsAdmin: ['sentry/utils/statics-setup', path.join(staticPrefix, 'gsAdmin')],

    /**
     * Legacy CSS Webpack appConfig for Django-powered views.
     * This generates a single "sentry.css" file that imports ALL component styles
     * for use on Django-powered pages.
     */
    sentry: 'less/sentry.less',
  },
  context: staticPrefix,
  experiments: {
    // https://rspack.dev/config/experiments#experimentsincremental
    incremental: DEV_MODE,
    futureDefaults: true,
    // Native css parsing not working in production
    // Build production bundle and open the entrypoints/sentry.css file
    // Assets path should be `../assets/rubik.woff` not `assets/rubik.woff`
    // Not compatible with CssExtractRspackPlugin https://rspack.rs/guide/tech/css#using-cssextractrspackplugin
    css: false,
    // https://rspack.dev/config/experiments#experimentsnativewatcher
    // Switching branches seems to get stuck in build loop https://github.com/web-infra-dev/rspack/issues/11590
    nativeWatcher: false,
  },
  // Disable lazy compilation for now to avoid crashes when new modules are loaded
  // https://rspack.rs/config/lazy-compilation
  lazyCompilation: {
    imports: false,
    entries: false,
  },
  module: {
    /**
     * XXX: Modifying the order/contents of these rules may break `getsentry`
     * Please remember to test it.
     */
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        // Avoids recompiling core-js based on usage imports
        exclude: /node_modules[\\/]core-js/,
        loader: 'builtin:swc-loader',
        options: swcReactLoaderConfig,
      },
      {
        test: /\.mdx?$/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: swcReactLoaderConfig,
          },
          {
            loader: '@mdx-js/loader',
            options: {
              remarkPlugins: [
                remarkUnwrapMdxParagraphs,
                remarkFrontmatter,
                remarkMdxFrontmatter,
                remarkGfm,
                [
                  remarkCallout,
                  {
                    root: (callout: Callout) => {
                      return {
                        tagName: 'Callout',
                        properties: {
                          title: callout.title,
                          type: callout.type.toLowerCase(),
                          isFoldable: callout.isFoldable ?? false,
                          defaultFolded: callout.defaultFolded ?? false,
                        },
                      };
                    },
                  },
                ],
              ],
              rehypePlugins: [
                [
                  rehypeExpressiveCode,
                  {
                    useDarkModeMediaQuery: false,
                  },
                ],
              ],
            },
          },
        ],
      },
      {
        test: /\.po$/,
        use: {
          loader: 'po-catalog-loader',
          options: {
            referenceExtensions: ['.js', '.jsx', '.tsx'],
            domain: 'sentry',
          },
        },
      },
      {
        test: /\.pegjs$/,
        use: [
          {loader: path.resolve(import.meta.dirname, './build-utils/peggy-loader.ts')},
        ],
      },
      {
        test: /\.css/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.less$/,
        include: [staticPrefix],
        use: [
          {
            loader: rspack.CssExtractRspackPlugin.loader,
            options: {
              publicPath: 'auto',
            },
          },
          'css-loader',
          'less-loader',
        ],
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg|mp4)($|\?)/,
        type: 'asset',
      },
    ],
  },
  plugins: [
    /**
     * Without this, webpack will chunk the locales but attempt to load them all
     * eagerly.
     */
    new rspack.IgnorePlugin({
      contextRegExp: /moment$/,
      resourceRegExp: /^\.\/locale$/,
    }),

    /**
     * Restrict translation files that are pulled in through app/translations.jsx
     * and through moment/locale/* to only those which we create bundles for via
     * locale/catalogs.json.
     *
     * Without this, webpack will still output all of the unused locale files despite
     * the application never loading any of them.
     */
    new rspack.ContextReplacementPlugin(
      /sentry-locale$/,
      path.join(import.meta.dirname, 'src', 'sentry', 'locale', path.sep),
      true,
      new RegExp(`(${supportedLocales.join('|')})/.*\\.po$`)
    ),
    new rspack.ContextReplacementPlugin(
      /moment\/locale/,
      new RegExp(`(${supportedLanguages.join('|')})\\.js$`)
    ),

    /**
     * The platformicons package uses dynamic require() to load SVG files:
     * require(`../${format === "lg" ? "svg_80x80" : "svg"}/${icon}.svg`)
     *
     * This plugin tells rspack where to find those SVG files by providing
     * proper context for the dynamic imports.
     */
    new rspack.ContextReplacementPlugin(/platformicons/, /\.svg$/),

    /**
     * TODO(epurkhiser): Figure out if we still need these
     */
    new rspack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),

    /**
     * Extract CSS into separate files.
     * https://rspack.rs/plugins/rspack/css-extract-rspack-plugin
     */
    new rspack.CssExtractRspackPlugin({
      // We want the sentry css file to be unversioned for frontend-only deploys
      // We will cache using `Cache-Control` headers
      filename: 'entrypoints/[name].css',
    }),

    /**
     * Defines environment specific flags.
     */
    new rspack.DefinePlugin({
      'process.env.IS_ACCEPTANCE_TEST': JSON.stringify(IS_ACCEPTANCE_TEST),
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV),
      'process.env.DEPLOY_PREVIEW_CONFIG': JSON.stringify(DEPLOY_PREVIEW_CONFIG),
      'process.env.EXPERIMENTAL_SPA': JSON.stringify(SENTRY_EXPERIMENTAL_SPA),
      'process.env.SPA_DSN': JSON.stringify(SENTRY_SPA_DSN),
      'process.env.SENTRY_RELEASE_VERSION': JSON.stringify(SENTRY_RELEASE_VERSION),
      'process.env.USE_REACT_QUERY_DEVTOOL': JSON.stringify(USE_REACT_QUERY_DEVTOOL),
      'process.env.ENABLE_SENTRY_TOOLBAR': JSON.stringify(ENABLE_SENTRY_TOOLBAR),
    }),

    ...(SHOULD_FORK_TS
      ? [
          new TsCheckerRspackPlugin({
            typescript: {
              configFile: path.resolve(
                import.meta.dirname,
                './config/tsconfig.build.json'
              ),
            },
            devServer: false,
          }),
        ]
      : []),

    ...(SHOULD_ADD_RSDOCTOR ? [new RsdoctorRspackPlugin({})] : []),

    /**
     * Copies file logo-sentry.svg to the dist/entrypoints directory so that it can be accessed by
     * the backend
     */
    new rspack.CopyRspackPlugin({
      patterns: [
        {
          from: path.join(staticPrefix, 'images/logo-sentry.svg'),
          to: 'entrypoints/logo-sentry.svg',
          toType: 'file',
        },
        // Add robots.txt when deploying in preview mode so public previews do
        // not get indexed by bots.
        ...(IS_DEPLOY_PREVIEW
          ? [
              {
                from: path.join(staticPrefix, 'robots-dev.txt'),
                to: 'robots.txt',
                toType: 'file' as const,
              },
            ]
          : []),
      ],
    }),
  ],

  resolveLoader: {
    alias: {
      'type-loader': path.resolve(
        import.meta.dirname,
        'static/app/stories/type-loader.ts'
      ),
    },
  },

  resolve: {
    alias: {
      sentry: path.join(staticPrefix, 'app'),
      'sentry-images': path.join(staticPrefix, 'images'),
      'sentry-logos': path.join(sentryDjangoAppPath, 'images', 'logos'),
      'sentry-fonts': path.join(staticPrefix, 'fonts'),

      '@sentry/scraps': path.join(staticPrefix, 'app', 'components', 'core'),

      getsentry: path.join(staticPrefix, 'gsApp'),
      'getsentry-images': path.join(staticPrefix, 'images'),
      'getsentry-test': path.join(import.meta.dirname, 'tests', 'js', 'getsentry-test'),
      admin: path.join(staticPrefix, 'gsAdmin'),

      // Aliasing this for getsentry's build, otherwise `less/select2` will not be able
      // to be resolved
      less: path.join(staticPrefix, 'less'),
      'sentry-test': path.join(import.meta.dirname, 'tests', 'js', 'sentry-test'),
      'sentry-locale': path.join(import.meta.dirname, 'src', 'sentry', 'locale'),
      'ios-device-list': path.join(
        import.meta.dirname,
        'node_modules',
        'ios-device-list',
        'dist',
        'ios-device-list.min.js'
      ),
    },

    fallback: {
      vm: false,
      stream: false,
      // Node crypto is imported in @sentry-internal/global-search but not used here
      crypto: false,
      // `pnpm why` says this is only needed in dev deps
      string_decoder: false,
      // For framer motion v6, might be able to remove on v11
      'process/browser': require.resolve('process/browser'),
    },

    // Prefers local modules over node_modules
    preferAbsolute: true,
    modules: ['node_modules'],
    extensions: ['.js', '.tsx', '.ts', '.json', '.less'],
    symlinks: true,
  },
  output: {
    crossOriginLoading: 'anonymous',
    clean: true, // Clean the output directory before emit.
    path: distPath,
    publicPath: '',
    filename: 'entrypoints/[name].js',
    chunkFilename: 'chunks/[name].[contenthash].js',
    sourceMapFilename: 'sourcemaps/[name].[contenthash].js.map',
    assetModuleFilename: 'assets/[name].[contenthash][ext]',
  },
  optimization: {
    chunkIds: 'named',
    moduleIds: 'named',
    splitChunks: {
      // Only affect async chunks, otherwise webpack could potentially split our initial chunks
      // Which means the app will not load because we'd need these additional chunks to be loaded in our
      // django template.
      chunks: 'async',
      maxInitialRequests: 10, // (default: 30)
      maxAsyncRequests: 10, // (default: 30)
      cacheGroups: localeChunkGroups,
    },

    // This only runs in production mode
    minimizer: [
      new rspack.LightningCssMinimizerRspackPlugin(),
      new rspack.SwcJsMinimizerRspackPlugin(),
    ],
  },
  devtool: IS_PRODUCTION ? 'source-map' : 'eval-cheap-module-source-map',
};

if (IS_TEST) {
  (appConfig.resolve!.alias! as Record<string, string>)['sentry-fixture'] = path.join(
    import.meta.dirname,
    'fixtures',
    'js-stubs'
  );
}

if (IS_ACCEPTANCE_TEST) {
  appConfig.plugins?.push(new LastBuiltPlugin({basePath: import.meta.dirname}));
}

// Dev only! Hot module reloading
if (
  FORCE_WEBPACK_DEV_SERVER ||
  (HAS_WEBPACK_DEV_SERVER_CONFIG && !NO_DEV_SERVER) ||
  IS_UI_DEV_ONLY
) {
  if (SHOULD_HOT_MODULE_RELOAD) {
    // Hot reload react components on save
    // We include the library here as to not break docker/google cloud builds
    // since we do not install devDeps there.
    appConfig.plugins?.push(new ReactRefreshRspackPlugin());

    // TODO: figure out why defining output breaks hot reloading
    if (IS_UI_DEV_ONLY) {
      appConfig.output = {};
    }
  }

  appConfig.devServer = {
    headers: {
      'Document-Policy': 'js-profiling',
    },
    // Cover the various environments we use (vercel, getsentry-dev, localhost)
    allowedHosts: [
      '.sentry.dev',
      '.dev.getsentry.net',
      '.localhost',
      '127.0.0.1',
      '.docker.internal',
      // SEO: ngrok, hot reload, SENTRY_UI_HOT_RELOAD. Uncomment this to allow hot-reloading when using ngrok. This is disabled by default
      // since ngrok urls are public and can be accessed by anyone.
      // '.ngrok.io',
    ],
    static: {
      directory: './src/sentry/static/sentry',
      watch: true,
    },
    host: SENTRY_WEBPACK_PROXY_HOST,
    hot: SHOULD_HOT_MODULE_RELOAD,
    port: Number(SENTRY_WEBPACK_PROXY_PORT),
    devMiddleware: {
      stats: 'errors-only',
    },
    client: {
      overlay: false,
    },
  };

  if (!IS_UI_DEV_ONLY) {
    // This proxies to local backend server
    const backendAddress = `http://127.0.0.1:${SENTRY_BACKEND_PORT}/`;
    const relayAddress = 'http://127.0.0.1:7899';

    // If we're running siloed servers we also need to proxy
    // those requests to the right server.
    let controlSiloProxy: Required<DevServer['proxy']> = [];
    if (CONTROL_SILO_PORT) {
      // TODO(hybridcloud) We also need to use this URL pattern
      // list to select contro/region when making API requests in non-proxied
      // environments (like production). We'll likely need a way to consolidate this
      // with the configuration api.Client uses.
      const controlSiloAddress = `http://127.0.0.1:${CONTROL_SILO_PORT}`;
      controlSiloProxy = [
        {
          context: [
            '/auth/**',
            '/account/**',
            '/api/0/users/**',
            '/api/0/api-tokens/**',
            '/api/0/sentry-apps/**',
            '/api/0/organizations/*/audit-logs/**',
            '/api/0/organizations/*/broadcasts/**',
            '/api/0/organizations/*/integrations/**',
            '/api/0/organizations/*/config/integrations/**',
            '/api/0/organizations/*/sentry-apps/**',
            '/api/0/organizations/*/sentry-app-installations/**',
            '/api/0/api-authorizations/**',
            '/api/0/api-applications/**',
            '/api/0/doc-integrations/**',
            '/api/0/assistant/**',
          ],
          target: controlSiloAddress,
        },
      ];
    }

    appConfig.devServer = {
      ...appConfig.devServer,
      static: {
        ...(appConfig.devServer.static as Record<PropertyKey, unknown>),
        publicPath: '/_static/dist/sentry',
      },
      // syntax for matching is using https://www.npmjs.com/package/micromatch
      proxy: [
        ...controlSiloProxy,
        {
          context: [
            '/api/store/**',
            '/api/{1..9}*({0..9})/**',
            '/api/0/relays/outcomes/**',
          ],
          target: relayAddress,
        },
        {
          context: ['!/_static/dist/sentry/**'],
          target: backendAddress,
        },
      ],
    };
    appConfig.output!.publicPath = '/_static/dist/sentry/';
  }
}

// XXX(epurkhiser): Sentry (development) can be run in an experimental
// pure-SPA mode, where ONLY /api* requests are proxied directly to the API
// backend (in this case, sentry.io), otherwise ALL requests are rewritten
// to a development index.html -- thus, completely separating the frontend
// from serving any pages through the backend.
//
// THIS IS EXPERIMENTAL and has limitations (e.g. you can't use SSO)
//
// Various sentry pages still rely on django to serve html views.
if (IS_UI_DEV_ONLY) {
  // XXX: If you change this also change its sibiling in:
  // - static/index.ejs
  // - static/app/utils/extractSlug.tsx
  const KNOWN_DOMAINS =
    /(?:\.?)((?:localhost|dev\.getsentry\.net|sentry\.dev)(?::\d*)?)$/;

  const extractSlug = (hostname: string) => {
    const match = hostname.match(KNOWN_DOMAINS);
    if (!match) {
      return null;
    }

    const [
      matchedExpression, // Expression includes optional leading `.`
    ] = match;

    const [slug] = hostname.replace(matchedExpression, '').split('.');
    return slug;
  };

  // Try and load certificates from mkcert if available. Use $ pnpm mkcert-localhost
  const certPath = path.join(import.meta.dirname, 'config');
  const httpsOptions = fs.existsSync(path.join(certPath, 'localhost.pem'))
    ? {
        key: fs.readFileSync(path.join(certPath, 'localhost-key.pem')),
        cert: fs.readFileSync(path.join(certPath, 'localhost.pem')),
      }
    : {};

  appConfig.devServer = {
    ...appConfig.devServer,
    compress: true,
    server: {
      type: 'https',
      options: httpsOptions,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Document-Policy': 'js-profiling',
    },
    static: {
      publicPath: '/_assets/',
    },
    proxy: [
      {
        context: ['/api/', '/avatar/', '/organization-avatar/', '/extensions/'],
        target: 'https://sentry.io',
        secure: false,
        changeOrigin: true,
        headers: {
          Referer: 'https://sentry.io/',
          'Document-Policy': 'js-profiling',
          origin: 'https://sentry.io',
        },
        cookieDomainRewrite: {'.sentry.io': 'localhost'},
        router: req => {
          const orgSlug = extractSlug((req as any).hostname);
          return orgSlug ? `https://${orgSlug}.sentry.io` : 'https://sentry.io';
        },
      },
      {
        // Handle dev-ui region silo requests.
        // Normally regions act as subdomains, but doing so in dev-ui
        // would result in requests bypassing webpack proxy and being sent
        // directly to region servers. These requests would fail because of CORS.
        // Instead Client prefixes region requests with `/region/$name` which
        // we rewrite in the proxy.
        context: ['/region/'],
        target: 'https://us.sentry.io',
        secure: false,
        changeOrigin: true,
        headers: {
          Referer: 'https://sentry.io/',
          'Document-Policy': 'js-profiling',
          origin: 'https://sentry.io',
        },
        cookieDomainRewrite: {'.sentry.io': 'localhost'},
        pathRewrite: {
          '^/region/[^/]*': '',
        },
        router: (req: any) => {
          const regionPathPattern = /^\/region\/([^/]+)/;
          const regionname = req.path.match(regionPathPattern);
          if (regionname) {
            return `https://${regionname[1]}.sentry.io`;
          }
          return 'https://sentry.io';
        },
      },
    ],
    historyApiFallback: {
      rewrites: [{from: /^\/.*$/, to: '/_assets/index.html'}],
    },
  };
  // Hot reloading breaks if we aren't using a single runtime chunk
  appConfig.optimization!.runtimeChunk = 'single';
}

if (IS_UI_DEV_ONLY || SENTRY_EXPERIMENTAL_SPA) {
  appConfig.output!.publicPath = '/_assets/';

  /**
   * Generate a index.html file used for running the app in pure client mode.
   * This is currently used for PR deploy previews, where only the frontend
   * is deployed.
   */
  appConfig.plugins?.push(
    new HtmlWebpackPlugin({
      // Local dev vs vercel slightly differs...
      ...(IS_UI_DEV_ONLY
        ? {devServer: `https://127.0.0.1:${SENTRY_WEBPACK_PROXY_PORT}`}
        : {}),
      favicon: path.resolve(sentryDjangoAppPath, 'images', 'favicon-dev.png'),
      template: path.resolve(staticPrefix, 'index.ejs'),
      mobile: true,
      excludeChunks: IS_ADMIN_UI_DEV ? ['pipeline', 'app'] : ['pipeline', 'gsAdmin'],
      title: 'Sentry',
      window: {
        __SENTRY_DEV_UI: true,
      },
    })
  );
}

if (IS_PRODUCTION) {
  // This compression-webpack-plugin generates pre-compressed files
  // ending in .gz, to be picked up and served by our internal static media
  // server as well as nginx when paired with the gzip_static module.
  appConfig.plugins?.push(
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|map|css|svg|html|txt|ico|eot|ttf)$/,
    })
  );

  // Enable sentry-webpack-plugin for production builds
  appConfig.plugins?.push(
    sentryWebpackPlugin({
      applicationKey: 'sentry-spa',
      telemetry: false,
      sourcemaps: {
        disable: true,
      },
      release: {
        create: false,
      },
      reactComponentAnnotation: {
        // Using swc-plugin-react-component-annotate instead
        enabled: false,
      },
      bundleSizeOptimizations: {
        // This is enabled so that our SDKs send exceptions to Sentry
        excludeDebugStatements: false,
        excludeReplayIframe: true,
        excludeReplayShadowDom: true,
      },
    })
  );
}

if (CODECOV_TOKEN && ENABLE_CODECOV_BA) {
  const {codecovWebpackPlugin} = require('@codecov/webpack-plugin');
  // defaulting to an empty string which in turn will fallback to env var or
  // determine merge commit sha from git
  const GH_COMMIT_SHA = env.GH_COMMIT_SHA ?? '';

  appConfig.plugins?.push(
    codecovWebpackPlugin({
      enableBundleAnalysis: true,
      bundleName: 'app-webpack-bundle',
      uploadToken: CODECOV_TOKEN,
      debug: true,
      gitService: 'github',
      uploadOverrides: {
        sha: GH_COMMIT_SHA,
      },
    })
  );
}

// Cache rspack builds
if (env.WEBPACK_CACHE_PATH) {
  appConfig.cache = true;
  appConfig.experiments!.cache = {
    type: 'persistent',
    // https://rspack.dev/config/experiments#cachestorage
    storage: {
      type: 'filesystem',
      directory: path.join(import.meta.dirname, env.WEBPACK_CACHE_PATH),
    },
  };
}

export default appConfig;
