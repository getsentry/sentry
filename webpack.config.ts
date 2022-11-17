/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import fs from 'fs';
import path from 'path';

import CompressionPlugin from 'compression-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack from 'webpack';
import {Configuration as DevServerConfig} from 'webpack-dev-server';
import FixStyleOnlyEntriesPlugin from 'webpack-remove-empty-scripts';

import IntegrationDocsFetchPlugin from './build-utils/integration-docs-fetch-plugin';
import LastBuiltPlugin from './build-utils/last-built-plugin';
import SentryInstrumentation from './build-utils/sentry-instrumentation';
import {extractIOSDeviceNames} from './scripts/extract-ios-device-names';
import babelConfig from './babel.config';

// Runs as part of prebuild step to generate a list of identifier -> name mappings for  iOS
(async () => {
  await extractIOSDeviceNames();
})();

/**
 * Merges the devServer config into the webpack config
 *
 * See: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/43232
 */
interface Configuration extends webpack.Configuration {
  devServer?: DevServerConfig;
}

const {env} = process;

// Environment configuration
env.NODE_ENV = env.NODE_ENV ?? 'development';
const IS_PRODUCTION = env.NODE_ENV === 'production';
const IS_TEST = env.NODE_ENV === 'test' || !!env.TEST_SUITE;
const IS_STORYBOOK = env.STORYBOOK_BUILD === '1';

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
const WEBPACK_MODE: Configuration['mode'] = IS_PRODUCTION ? 'production' : 'development';

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
const SHOULD_LAZY_LOAD = DEV_MODE && !!env.SENTRY_UI_LAZY_LOAD;

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

// Locale file extraction build step
if (env.SENTRY_EXTRACT_TRANSLATIONS === '1') {
  babelConfig.plugins?.push([
    'module:babel-gettext-extractor',
    {
      fileName: 'build/javascript.po',
      baseDirectory: path.join(__dirname),
      functionNames: {
        gettext: ['msgid'],
        ngettext: ['msgid', 'msgid_plural', 'count'],
        gettextComponentTemplate: ['msgid'],
        t: ['msgid'],
        tn: ['msgid', 'msgid_plural', 'count'],
        tct: ['msgid'],
      },
    },
  ]);
}

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

type CacheGroups = Exclude<
  NonNullable<Configuration['optimization']>['splitChunks'],
  false | undefined
>['cacheGroups'];

type CacheGroupTest = (
  module: webpack.Module,
  context: Parameters<webpack.optimize.SplitChunksPlugin['options']['getCacheGroups']>[1]
) => boolean;

// A mapping of chunk groups used for locale code splitting
const localeChunkGroups: CacheGroups = {};

supportedLocales
  // No need to split the english locale out as it will be completely empty and
  // is not included in the django layout.html.
  .filter(l => l !== 'en')
  .forEach(locale => {
    const language = localeToLanguage(locale);
    const group = `locale/${language}`;

    // List of module path tests to group into locale chunks
    const localeGroupTests = [
      new RegExp(`locale\\/${locale}\\/.*\\.po$`),
      new RegExp(`moment\\/locale\\/${language}\\.js$`),
    ];

    // module test taken from [0] and modified to support testing against
    // multiple expressions.
    //
    // [0] https://github.com/webpack/webpack/blob/7a6a71f1e9349f86833de12a673805621f0fc6f6/lib/optimize/SplitChunksPlugin.js#L309-L320
    const groupTest: CacheGroupTest = (module, {chunkGraph}) =>
      localeGroupTests.some(pattern =>
        pattern.test(module?.nameForCondition?.() ?? '')
          ? true
          : chunkGraph.getModuleChunks(module).some(c => c.name && pattern.test(c.name))
      );

    // We are defining a chunk that combines the django language files with
    // moment's locales as if you want one, you will want the other.
    //
    // In the application code you will still need to import via their module
    // paths and not the chunk name
    localeChunkGroups[group] = {
      chunks: 'async',
      name: group,
      test: groupTest,
      enforce: true,
    };
  });

const babelOptions = {...babelConfig, cacheDirectory: true};
const babelLoaderConfig = {
  loader: 'babel-loader',
  options: babelOptions,
};

/**
 * Main Webpack config for Sentry React SPA.
 */
const appConfig: Configuration = {
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
  module: {
    /**
     * XXX: Modifying the order/contents of these rules may break `getsentry`
     * Please remember to test it.
     */
    rules: [
      {
        test: /\.[tj]sx?$/,
        include: [staticPrefix],
        exclude: /(vendor|node_modules|dist)/,
        use: babelLoaderConfig,
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
        use: {loader: 'pegjs-loader'},
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
            loader: MiniCssExtractPlugin.loader,
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
    noParse: [
      // don't parse known, pre-built javascript files (improves webpack perf)
      /jed\/jed\.js/,
      /marked\/lib\/marked\.js/,
      /terser\/dist\/bundle\.min\.js/,
    ],
  },
  plugins: [
    // Do not bundle moment's locale files as we will lazy load them using
    // dynamic imports in the application code
    new webpack.IgnorePlugin({
      contextRegExp: /moment$/,
      resourceRegExp: /^\.\/locale$/,
    }),

    /**
     * TODO(epurkhiser): Figure out if we still need these
     */
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),

    /**
     * Extract CSS into separate files.
     */
    new MiniCssExtractPlugin({
      // We want the sentry css file to be unversioned for frontend-only deploys
      // We will cache using `Cache-Control` headers
      filename: 'entrypoints/[name].css',
    }),

    /**
     * Defines environment specific flags.
     */
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(env.NODE_ENV),
        IS_ACCEPTANCE_TEST: JSON.stringify(IS_ACCEPTANCE_TEST),
        DEPLOY_PREVIEW_CONFIG: JSON.stringify(DEPLOY_PREVIEW_CONFIG),
        EXPERIMENTAL_SPA: JSON.stringify(SENTRY_EXPERIMENTAL_SPA),
        SPA_DSN: JSON.stringify(SENTRY_SPA_DSN),
        SENTRY_RELEASE_VERSION: JSON.stringify(SENTRY_RELEASE_VERSION),
      },
    }),

    /**
     * This removes empty js files for style only entries (e.g. sentry.less)
     */
    new FixStyleOnlyEntriesPlugin({verbose: false}),

    /**
     * Adds build time measurement instrumentation, which will be reported back
     * to sentry
     */
    new SentryInstrumentation(),

    ...(SHOULD_FORK_TS
      ? [
          new ForkTsCheckerWebpackPlugin({
            typescript: {
              configFile: path.resolve(__dirname, './config/tsconfig.build.json'),
              configOverwrite: {
                compilerOptions: {incremental: true},
              },
              memoryLimit: 3072,
            },
            devServer: false,
          }),
        ]
      : []),

    /**
     * Restrict translation files that are pulled in through app/translations.jsx
     * and through moment/locale/* to only those which we create bundles for via
     * locale/catalogs.json.
     *
     * Without this, webpack will still output all of the unused locale files despite
     * the application never loading any of them.
     */
    new webpack.ContextReplacementPlugin(
      /sentry-locale$/,
      path.join(__dirname, 'src', 'sentry', 'locale', path.sep),
      true,
      new RegExp(`(${supportedLocales.join('|')})/.*\\.po$`)
    ),
    new webpack.ContextReplacementPlugin(
      /moment\/locale/,
      new RegExp(`(${supportedLanguages.join('|')})\\.js$`)
    ),

    /**
     * Copies file logo-sentry.svg to the dist/entrypoints directory so that it can be accessed by
     * the backend
     */
    new CopyPlugin({
      patterns: [
        {
          from: `${staticPrefix}/images/logo-sentry.svg`,
          to: 'entrypoints/logo-sentry.svg',
          toType: 'file',
        },
      ],
    }),
  ],

  resolve: {
    alias: {
      'react-dom$': 'react-dom/profiling',
      'scheduler/tracing': 'scheduler/tracing-profiling',
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
  },
  output: {
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
      cacheGroups: {
        ...localeChunkGroups,
      },
    },

    // This only runs in production mode
    // Grabbed this example from https://github.com/webpack-contrib/css-minimizer-webpack-plugin
    minimizer: ['...', new CssMinimizerPlugin()],
  },
  devtool: IS_PRODUCTION ? 'source-map' : 'eval-cheap-module-source-map',
};

if (IS_TEST || IS_ACCEPTANCE_TEST || IS_STORYBOOK) {
  appConfig.resolve!.alias!['integration-docs-platforms'] = path.join(
    __dirname,
    'fixtures/integration-docs/_platforms.json'
  );
} else {
  const plugin = new IntegrationDocsFetchPlugin({basePath: __dirname});
  appConfig.plugins?.push(plugin);
  appConfig.resolve!.alias!['integration-docs-platforms'] = plugin.modulePath;
}

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
    const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
    appConfig.plugins?.push(new ReactRefreshWebpackPlugin());

    // TODO: figure out why defining output breaks hot reloading
    if (IS_UI_DEV_ONLY) {
      appConfig.output = {};
    }

    if (SHOULD_LAZY_LOAD) {
      appConfig.experiments = {
        lazyCompilation: {
          // enable lazy compilation for dynamic imports
          imports: true,
          // disable lazy compilation for entries
          entries: false,
        },
      };
    }
  }

  appConfig.devServer = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    // Required for getsentry
    allowedHosts: 'all',
    static: {
      directory: './src/sentry/static/sentry',
      watch: true,
    },
    host: SENTRY_WEBPACK_PROXY_HOST,
    // Don't reload on errors
    hot: 'only',
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

    appConfig.devServer = {
      ...appConfig.devServer,
      static: {
        ...(appConfig.devServer.static as object),
        publicPath: '/_static/dist/sentry',
      },
      // syntax for matching is using https://www.npmjs.com/package/micromatch
      proxy: {
        '/api/store/**': relayAddress,
        '/api/{1..9}*({0..9})/**': relayAddress,
        '/api/0/relays/outcomes/': relayAddress,
        '!/_static/dist/sentry/**': backendAddress,
      },
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
    static: {
      publicPath: '/_assets/',
    },
    proxy: [
      {
        context: ['/api/', '/avatar/', '/organization-avatar/'],
        target: 'https://sentry.io',
        secure: false,
        changeOrigin: true,
        headers: {
          Referer: 'https://sentry.io/',
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

if (IS_UI_DEV_ONLY || IS_DEPLOY_PREVIEW) {
  appConfig.output!.publicPath = '/_assets/';

  /**
   * Generate a index.html file used for running the app in pure client mode.
   * This is currently used for PR deploy previews, where only the frontend
   * is deployed.
   */
  const HtmlWebpackPlugin = require('html-webpack-plugin');
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
    })
  );
}

const minificationPlugins = [
  // This compression-webpack-plugin generates pre-compressed files
  // ending in .gz, to be picked up and served by our internal static media
  // server as well as nginx when paired with the gzip_static module.
  //
  // TODO(ts): The current @types/compression-webpack-plugin is still targeting
  //           webpack@4, for now we just as any it.
  new CompressionPlugin({
    algorithm: 'gzip',
    test: /\.(js|map|css|svg|html|txt|ico|eot|ttf)$/,
  }) as any,
  // NOTE: In production mode webpack will automatically minify javascript
  // using the TerserWebpackPlugin.
];

if (IS_PRODUCTION) {
  // NOTE: can't do plugins.push(Array) because webpack/webpack#2217
  minificationPlugins.forEach(plugin => appConfig.plugins?.push(plugin));
}

// Cache webpack builds
if (env.WEBPACK_CACHE_PATH) {
  appConfig.cache = {
    type: 'filesystem',
    cacheLocation: path.resolve(__dirname, env.WEBPACK_CACHE_PATH),
    buildDependencies: {
      // This makes all dependencies of this file - build dependencies
      config: [__filename],
      // By default webpack and loaders are build dependencies
    },
  };
}

export default appConfig;
