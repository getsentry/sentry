/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import fs from 'fs';
import path from 'path';

import rspack from '@rspack/core';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';
import CompressionPlugin from 'compression-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
// TODO(@anonrig): Remove this when Rspack bundles it.
import {ContextReplacementPlugin} from 'webpack';
import WebpackHookPlugin from 'webpack-hook-plugin';

import LastBuiltPlugin from './build-utils/last-built-plugin';
import SentryInstrumentation from './build-utils/sentry-instrumentation';
import {extractIOSDeviceNames} from './scripts/extract-ios-device-names';

// Runs as part of prebuild step to generate a list of identifier -> name mappings for  iOS
(async () => {
  await extractIOSDeviceNames();
})();

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
const DEV_MODE = !(IS_PRODUCTION || IS_CI);
const WEBPACK_MODE: rspack.Configuration['mode'] = IS_PRODUCTION
  ? 'production'
  : 'development';
const CONTROL_SILO_PORT = env.SENTRY_CONTROL_SILO_PORT;

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
const SHOULD_FORK_TS = DEV_MODE && !env.NO_TS_FORK;
const SHOULD_HOT_MODULE_RELOAD = DEV_MODE && !!env.SENTRY_UI_HOT_RELOAD;
// const SHOULD_LAZY_LOAD = DEV_MODE && !!env.SENTRY_UI_LAZY_LOAD;

// Deploy previews are built using vercel. We can check if we're in vercel's
// build process by checking the existence of the PULL_REQUEST env var.
const DEPLOY_PREVIEW_CONFIG = IS_DEPLOY_PREVIEW && {
  branch: env.NOW_GITHUB_COMMIT_REF,
  commitSha: env.NOW_GITHUB_COMMIT_SHA,
  githubOrg: env.NOW_GITHUB_COMMIT_ORG,
  githubRepo: env.NOW_GITHUB_COMMIT_REPO,
};

// When deploy previews are enabled always enable experimental SPA mode --
// deploy previews are served standalone. Otherwise fallback to the environment
// configuration.
const SENTRY_EXPERIMENTAL_SPA =
  !DEPLOY_PREVIEW_CONFIG && !IS_UI_DEV_ONLY ? !!env.SENTRY_EXPERIMENTAL_SPA : true;

// We should only read from the SENTRY_SPA_DSN env variable if SENTRY_EXPERIMENTAL_SPA
// is true. This is to make sure we can validate that the experimental SPA mode is
// working properly.
const SENTRY_SPA_DSN = SENTRY_EXPERIMENTAL_SPA ? env.SENTRY_SPA_DSN : undefined;

// this is the path to the django "sentry" app, we output the webpack build here to `dist`
// so that `django collectstatic` and so that we can serve the post-webpack bundles
const sentryDjangoAppPath = path.join(__dirname, 'src/sentry/static/sentry');
const distPath = env.SENTRY_STATIC_DIST_PATH || path.join(sentryDjangoAppPath, 'dist');
const staticPrefix = path.join(__dirname, 'static');

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
  __dirname,
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
const localeChunkGroups: Record<string, rspack.OptimizationSplitChunksCacheGroup> = {};

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

/**
 * Main Webpack config for Sentry React SPA.
 */

const appConfig: rspack.Configuration = {
  mode: WEBPACK_MODE,
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

    /**
     * Legacy CSS Webpack appConfig for Django-powered views.
     * This generates a single "sentry.css" file that imports ALL component styles
     * for use on Django-powered pages.
     */
    sentry: 'less/sentry.less',
  },
  context: staticPrefix,
  experiments: {
    rspackFuture: {
      disableTransformByDefault: true,
    },
    css: true,
  },
  module: {
    /**
     * XXX: Modifying the order/contents of these rules may break `getsentry`
     * Please remember to test it.
     */
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /\/node_modules\//,
        loader: 'builtin:swc-loader',
        options: {
          rspackExperiments: {
            emotion: {
              sourceMap: true,
            },
          },
          sourceMap: true,
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
            },
            target: 'es5', // this is a workaround because swc-emotion has a bug dealing with es5 tag template,see https://github.com/vercel/next.js/issues/38301
            transform: {
              react: {
                runtime: 'automatic',
                development: DEV_MODE,
                refresh: DEV_MODE,
                importSource: '@emotion/react',
              },
            },
          },
        },
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
        test: /\.pegjs/,
        loader: 'pegjs-loader',
      },
      {
        test: /\.css/,
        type: 'css',
      },
      {
        test: /\.less$/,
        include: [staticPrefix],
        use: ['less-loader'],
        type: 'css',
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg|mp4)($|\?)/,
        type: 'asset',
      },
    ],
  },
  plugins: [
    /**
     * Adds build time measurement instrumentation, which will be reported back
     * to sentry
     */
    new SentryInstrumentation(),

    /**
     * TODO(epurkhiser): Figure out if we still need these
     */
    new rspack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),

    /**
     * Defines environment specific flags.
     */
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV),
      'process.env.IS_ACCEPTANCE_TEST': JSON.stringify(IS_ACCEPTANCE_TEST),
      'process.env.DEPLOY_PREVIEW_CONFIG': JSON.stringify(DEPLOY_PREVIEW_CONFIG),
      'process.env.EXPERIMENTAL_SPA': JSON.stringify(SENTRY_EXPERIMENTAL_SPA),
      'process.env.SPA_DSN': JSON.stringify(SENTRY_SPA_DSN),
      'process.env.SENTRY_RELEASE_VERSION': JSON.stringify(SENTRY_RELEASE_VERSION),
    }),

    /**
     * Restrict translation files that are pulled in through app/translations.jsx
     * and through moment/locale/* to only those which we create bundles for via
     * locale/catalogs.json.
     *
     * Without this, webpack will still output all of the unused locale files despite
     * the application never loading any of them.
     */
    new ContextReplacementPlugin(
      /sentry-locale$/,
      path.join(__dirname, 'src', 'sentry', 'locale', path.sep),
      true,
      new RegExp(`(${supportedLocales.join('|')})/.*\\.po$`)
    ),
    new ContextReplacementPlugin(
      /moment\/locale/,
      new RegExp(`(${supportedLanguages.join('|')})\\.js$`)
    ),

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

  resolve: {
    alias: {
      sentry: path.join(staticPrefix, 'app'),
      'sentry-images': path.join(staticPrefix, 'images'),
      'sentry-logos': path.join(sentryDjangoAppPath, 'images', 'logos'),
      'sentry-fonts': path.join(staticPrefix, 'fonts'),

      // Aliasing this for getsentry's build, otherwise `less/select2` will not be able
      // to be resolved
      less: path.join(staticPrefix, 'less'),
      'sentry-test': path.join(__dirname, 'tests', 'js', 'sentry-test'),
      'sentry-locale': path.join(__dirname, 'src', 'sentry', 'locale'),
      'ios-device-list': path.join(
        __dirname,
        'node_modules',
        'ios-device-list',
        'dist',
        'ios-device-list.min.js'
      ),
    },

    fallback: {
      vm: false,
      stream: false,
      crypto: require.resolve('crypto-browserify'),
      // `yarn why` says this is only needed in dev deps
      string_decoder: false,
    },

    modules: ['node_modules'],
    extensions: ['.jsx', '.js', '.json', '.ts', '.tsx', '.less'],
    tsConfigPath: path.resolve(__dirname, './tsconfig.json'),
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
      new rspack.SwcCssMinimizerRspackPlugin(),
      new rspack.SwcJsMinimizerRspackPlugin(),
    ],
  },
  devtool: IS_PRODUCTION ? 'source-map' : 'eval-cheap-module-source-map',
};

if (IS_TEST) {
  appConfig.resolve!.alias!['sentry-fixture'] = path.join(
    __dirname,
    'fixtures',
    'js-stubs'
  );
}
if (IS_TEST || IS_ACCEPTANCE_TEST) {
  appConfig.resolve!.alias!['integration-docs-platforms'] = path.join(
    __dirname,
    'fixtures/integration-docs/_platforms.json'
  );
} else {
  // const plugin = new IntegrationDocsFetchPlugin({basePath: __dirname});
  // appConfig.plugins?.push(plugin);
  // appConfig.resolve!.alias!['integration-docs-platforms'] = plugin.modulePath;
}
//
if (IS_ACCEPTANCE_TEST) {
  appConfig.plugins?.push(new LastBuiltPlugin({basePath: __dirname}));
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

    // if (SHOULD_LAZY_LOAD) {
    //   appConfig.experiments = {
    //     lazyCompilation: {
    //       // enable lazy compilation for dynamic imports
    //       imports: true,
    //       // disable lazy compilation for entries
    //       entries: false,
    //     },
    //   };
    // }
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
    let controlSiloProxy = {};
    if (CONTROL_SILO_PORT) {
      // TODO(hybridcloud) We also need to use this URL pattern
      // list to select contro/region when making API requests in non-proxied
      // environments (like production). We'll likely need a way to consolidate this
      // with the configuration api.Client uses.
      const controlSiloAddress = `http://127.0.0.1:${CONTROL_SILO_PORT}`;
      controlSiloProxy = {
        '/auth/**': controlSiloAddress,
        '/account/**': controlSiloAddress,
        '/api/0/users/**': controlSiloAddress,
        '/api/0/api-tokens/**': controlSiloAddress,
        '/api/0/sentry-apps/**': controlSiloAddress,
        '/api/0/organizations/*/audit-logs/**': controlSiloAddress,
        '/api/0/organizations/*/broadcasts/**': controlSiloAddress,
        '/api/0/organizations/*/integrations/**': controlSiloAddress,
        '/api/0/organizations/*/config/integrations/**': controlSiloAddress,
        '/api/0/organizations/*/sentry-apps/**': controlSiloAddress,
        '/api/0/organizations/*/sentry-app-installations/**': controlSiloAddress,
        '/api/0/api-authorizations/**': controlSiloAddress,
        '/api/0/api-applications/**': controlSiloAddress,
        '/api/0/doc-integrations/**': controlSiloAddress,
        '/api/0/assistant/**': controlSiloAddress,
      };
    }

    appConfig.devServer = {
      ...appConfig.devServer,
      static: {
        ...(appConfig.devServer!.static as object),
        publicPath: '/_static/dist/sentry',
      },
      // syntax for matching is using https://www.npmjs.com/package/micromatch
      proxy: {
        ...controlSiloProxy,
        '/api/store/**': relayAddress,
        '/api/{1..9}*({0..9})/**': relayAddress,
        '/api/0/relays/outcomes/': relayAddress,
        '!/_static/dist/sentry/**': backendAddress,
      },
    };
    appConfig.output!.publicPath = '/_static/dist/sentry/';
  }
}

// We want Spotlight only in Dev mode - Local and UI only
if (DEV_MODE) {
  appConfig.plugins?.push(
    new WebpackHookPlugin({
      onBuildStart: ['yarn run spotlight-sidecar'],
    }) as unknown as rspack.RspackPluginInstance
  );
}

if (SHOULD_FORK_TS) {
  appConfig.plugins?.push(
    new WebpackHookPlugin({
      onBuildStart: ['yarn tsc -p ./config/tsconfig.build.json --watch --incremental'],
    }) as unknown as rspack.RspackPluginInstance
  );
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
    /(?:\.?)((?:localhost|dev\.getsentry\.net|sentry\.dev)(?:\:\d*)?)$/;

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

  // Try and load certificates from mkcert if available. Use $ yarn mkcert-localhost
  const certPath = path.join(__dirname, 'config');
  const httpsOptions = !fs.existsSync(path.join(certPath, 'localhost.pem'))
    ? {}
    : {
        key: fs.readFileSync(path.join(certPath, 'localhost-key.pem')),
        cert: fs.readFileSync(path.join(certPath, 'localhost.pem')),
      };

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
        },
        cookieDomainRewrite: {'.sentry.io': 'localhost'},
        router: ({hostname}) => {
          const orgSlug = extractSlug(hostname);
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
        },
        cookieDomainRewrite: {'.sentry.io': 'localhost'},
        pathRewrite: {
          '^/region/[^/]*': '',
        },
        router: req => {
          const regionPathPattern = /^\/region\/([^\/]+)/;
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
  appConfig.optimization = {
    runtimeChunk: 'single',
  };
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
      favicon: path.resolve(sentryDjangoAppPath, 'images', 'favicon_dev.png'),
      template: path.resolve(staticPrefix, 'index.ejs'),
      mobile: true,
      excludeChunks: ['pipeline'],
      title: 'Sentry',
      window: {
        __SENTRY_DEV_UI: true,
      },
    }) as unknown as rspack.RspackPluginInstance
  );
}

const minificationPlugins: rspack.RspackPluginInstance[] = [
  // This compression-webpack-plugin generates pre-compressed files
  // ending in .gz, to be picked up and served by our internal static media
  // server as well as nginx when paired with the gzip_static module.
  new CompressionPlugin({
    algorithm: 'gzip',
    test: /\.(js|map|css|svg|html|txt|ico|eot|ttf)$/,
  }) as unknown as rspack.RspackPluginInstance,
];

if (IS_PRODUCTION) {
  appConfig.plugins?.push(...minificationPlugins);
}

// Cache webpack builds
if (env.WEBPACK_CACHE_PATH) {
  appConfig.cache = true;
}
export default appConfig;
