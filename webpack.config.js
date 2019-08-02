/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const babelConfig = require('./babel.config');
const OptionalLocaleChunkPlugin = require('./build-utils/optional-locale-chunk-plugin');
const IntegrationDocsFetchPlugin = require('./build-utils/integration-docs-fetch-plugin');
const ExtractTextPlugin = require('mini-css-extract-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const FixStyleOnlyEntriesPlugin = require('webpack-fix-style-only-entries');
const CopyPlugin = require('copy-webpack-plugin');

const {env} = process;
const IS_PRODUCTION = env.NODE_ENV === 'production';
const IS_TEST = env.NODE_ENV === 'test' || env.TEST_SUITE;
const IS_STORYBOOK = env.STORYBOOK_BUILD === '1';

const WEBPACK_MODE = IS_PRODUCTION ? 'production' : 'development';

// HMR proxying
const SENTRY_BACKEND_PORT = env.SENTRY_BACKEND_PORT;
const SENTRY_WEBPACK_PROXY_PORT = env.SENTRY_WEBPACK_PROXY_PORT;
const USE_HOT_MODULE_RELOAD =
  !IS_PRODUCTION && SENTRY_BACKEND_PORT && SENTRY_WEBPACK_PROXY_PORT;

// Deploy previews are built using netlify. We can check if we're in netlifys
// build process by checking the existance of the PULL_REQUEST env var.
//
// See: https://www.netlify.com/docs/continuous-deployment/#environment-variables
const DEPLOY_PREVIEW_CONFIG = env.PULL_REQUEST && {
  commitRef: env.COMMIT_REF,
  reviewId: env.REVIEW_ID,
  repoUrl: env.REPOSITORY_URL,
};

// When deploy previews are enabled always enable experimental SPA mode --
// deploy previews are served standalone. Otherwise fallback to the environment
// configuration.
const SENTRY_EXPERIMENTAL_SPA = !DEPLOY_PREVIEW_CONFIG
  ? env.SENTRY_EXPERIMENTAL_SPA
  : true;

// this is set by setup.py sdist
const staticPrefix = path.join(__dirname, 'src/sentry/static/sentry');
const distPath = env.SENTRY_STATIC_DIST_PATH || path.join(staticPrefix, 'dist');

/**
 * Locale file extraction build step
 */
if (env.SENTRY_EXTRACT_TRANSLATIONS === '1') {
  babelConfig.plugins.push([
    'babel-gettext-extractor',
    {
      fileName: 'build/javascript.po',
      baseDirectory: path.join(__dirname, 'src/sentry'),
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

/**
 * Locale compilation and optimizations.
 *
 * Locales are code-split from the app and vendor chunk into separate chunks
 * that will be loaded by layout.html depending on the users configured locale.
 *
 * Code splitting happens using the splitChunks plugin, configured under the
 * `optimization` key of the webpack module. We create chunk (cache) groups for
 * each of our supported locales and extract the PO files and moment.js locale
 * files into each chunk.
 *
 * A plugin is used to remove the locale chunks from the app entry's chunk
 * dependency list, so that our compiled bundle does not expect that *all*
 * locale chunks must be loadd
 */
const localeCatalogPath = path.join(
  __dirname,
  'src',
  'sentry',
  'locale',
  'catalogs.json'
);

const localeCatalog = JSON.parse(fs.readFileSync(localeCatalogPath, 'utf8'));

// Translates a locale name to a language code.
//
// * po files are kept in a directory represented by the locale name [0]
// * moment.js locales are stored as language code files
// * Sentry will request the user configured language from locale/{language}.js
//
// [0] https://docs.djangoproject.com/en/2.1/topics/i18n/#term-locale-name
const localeToLanguage = locale => locale.toLowerCase().replace('_', '-');

const supportedLocales = localeCatalog.supported_locales;
const supportedLanguages = supportedLocales.map(localeToLanguage);

// A mapping of chunk groups used for locale code splitting
const localeChunkGroups = {};

// No need to split the english locale out as it will be completely empty and
// is not included in the django layout.html.
supportedLocales
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
    const groupTest = module =>
      localeGroupTests.some(pattern =>
        module.nameForCondition && pattern.test(module.nameForCondition())
          ? true
          : Array.from(module.chunksIterable).some(c => c.name && pattern.test(c.name))
      );

    localeChunkGroups[group] = {
      name: group,
      test: groupTest,
      enforce: true,
    };
  });

/**
 * Restirct translation files that are pulled in through app/translations.jsx
 * and through moment/locale/* to only those which we create bundles for via
 * locale/catalogs.json.
 */
const localeRestrictionPlugins = [
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
];

/**
 * Explicit codesplitting cache groups
 */
const cacheGroups = {
  vendors: {
    name: 'vendor',
    test: /[\\/]node_modules[\\/]/,
    priority: -10,
    enforce: true,
    chunks: 'initial',
  },
  ...localeChunkGroups,
};

const babelOptions = {...babelConfig, cacheDirectory: true};

/**
 * Main Webpack config for Sentry React SPA.
 */
const appConfig = {
  mode: WEBPACK_MODE,
  entry: {app: 'app'},
  context: staticPrefix,
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        include: [staticPrefix],
        exclude: /(vendor|node_modules|dist)/,
        use: {
          loader: 'babel-loader',
          options: babelOptions,
        },
      },
      {
        test: /\.tsx?$/,
        include: [staticPrefix],
        exclude: /(vendor|node_modules|dist)/,
        use: [
          {
            loader: 'babel-loader',
            options: babelOptions,
          },
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /\.po$/,
        use: {
          loader: 'po-catalog-loader',
          options: {
            referenceExtensions: ['.js', '.jsx'],
            domain: 'sentry',
          },
        },
      },
      {
        test: /app\/icons\/.*\.svg$/,
        use: ['svg-sprite-loader', 'svgo-loader'],
      },
      {
        test: /\.css/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
        exclude: /app\/icons\/.*\.svg$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
            },
          },
        ],
      },
    ],
    noParse: [
      // don't parse known, pre-built javascript files (improves webpack perf)
      /dist\/jquery\.js/,
      /jed\/jed\.js/,
      /marked\/lib\/marked\.js/,
    ],
  },
  plugins: [
    /**
     * Used to make our lodash modules even smaller
     */
    new LodashModuleReplacementPlugin({
      collections: true,
      currying: true, // these are enabled to support lodash/fp/ features
      flattening: true, // used by a dependency of react-mentions
      shorthands: true,
      paths: true,
    }),
    /**
     * jQuery must be provided in the global scope specifically and only for
     * bootstrap, as it will not import jQuery itself.
     *
     * We discourage the use of global jQuery through eslint rules
     */
    new webpack.ProvidePlugin({jQuery: 'jquery'}),
    /**
     * Extract CSS into separate files.
     */
    new ExtractTextPlugin(),
    /**
     * Generate a index.html file used for running the app in pure client mode.
     * This is currently used for PR deploy previews, where only the frontend
     * is deployed.
     */
    new CopyPlugin([{from: path.join(staticPrefix, 'app', 'index.html')}]),
    /**
     * Defines environemnt specific flags.
     */
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(env.NODE_ENV),
        IS_PERCY: JSON.stringify(env.CI && !!env.PERCY_TOKEN && !!env.TRAVIS),
        DEPLOY_PREVIEW_CONFIG: JSON.stringify(DEPLOY_PREVIEW_CONFIG),
        EXPERIMENTAL_SPA: JSON.stringify(SENTRY_EXPERIMENTAL_SPA),
      },
    }),
    /**
     * See above for locale chunks. These plugins help with that
     * funcationality.
     */
    new OptionalLocaleChunkPlugin(),
    ...localeRestrictionPlugins,
  ],
  resolve: {
    alias: {
      app: path.join(staticPrefix, 'app'),
      'app-test': path.join(__dirname, 'tests', 'js'),
      'sentry-locale': path.join(__dirname, 'src', 'sentry', 'locale'),
    },
    modules: ['node_modules'],
    extensions: ['.jsx', '.js', '.json', '.ts', '.tsx'],
  },
  output: {
    path: distPath,
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 5,
      maxAsyncRequests: 7,
      cacheGroups,
    },
  },
  devtool: IS_PRODUCTION ? 'source-map' : 'cheap-module-eval-source-map',
};

if (IS_TEST || IS_STORYBOOK) {
  appConfig.resolve.alias['integration-docs-platforms'] = path.join(
    __dirname,
    'tests/fixtures/integration-docs/_platforms.json'
  );
} else {
  const plugin = new IntegrationDocsFetchPlugin({basePath: __dirname});
  appConfig.plugins.push(plugin);
  appConfig.resolve.alias['integration-docs-platforms'] = plugin.modulePath;
}

/**
 * Legacy CSS Webpack appConfig for Django-powered views.
 * This generates a single "sentry.css" file that imports ALL component styles
 * for use on Django-powered pages.
 */
const legacyCssConfig = {
  mode: WEBPACK_MODE,
  entry: {
    sentry: 'less/sentry.less',

    // Below is for old plugins that use select2 when creating a new issue for a plugin
    // e.g. Trello, Teamwork
    select2: 'less/select2.less',
  },
  context: staticPrefix,
  output: {
    path: distPath,
  },
  plugins: [new FixStyleOnlyEntriesPlugin(), new ExtractTextPlugin()],
  resolve: {
    extensions: ['.less', '.js'],
    modules: [staticPrefix, 'node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.less$/,
        include: [staticPrefix],
        use: [ExtractTextPlugin.loader, 'css-loader', 'less-loader'],
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
            },
          },
        ],
      },
    ],
  },
};

// Dev only! Hot module reloading
if (USE_HOT_MODULE_RELOAD) {
  const backendAddress = `http://localhost:${SENTRY_BACKEND_PORT}/`;

  appConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
  appConfig.devServer = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    // Required for getsentry
    disableHostCheck: true,
    contentBase: './src/sentry/static/sentry',
    hot: true,
    // If below is false, will reload on errors
    hotOnly: true,
    port: SENTRY_WEBPACK_PROXY_PORT,
    stats: 'errors-only',
    overlay: true,
    watchOptions: {
      ignored: ['node_modules'],
    },
    publicPath: '/_webpack',
    proxy: {'!/_webpack': backendAddress},
    before: app =>
      app.use((req, _res, next) => {
        req.url = req.url.replace(/^\/_static\/[^\/]+\/sentry\/dist/, '/_webpack');
        next();
      }),
  };

  // XXX(epurkhiser): Sentry (development) can be run in an experimental
  // pure-SPA mode, where ONLY /api* requests are proxied directly to the API
  // backend, otherwise ALL requests are rewritten to a development index.html.
  // Thus completely seperating the frontend from serving any pages through the
  // backend.
  //
  // THIS IS EXPERIMENTAL. Various sentry pages still rely on django to serve
  // html views.
  appConfig.devServer = !SENTRY_EXPERIMENTAL_SPA
    ? appConfig.devServer
    : {
        ...appConfig.devServer,
        before: () => undefined,
        publicPath: '/_assets',
        proxy: {'/api/': backendAddress},
        historyApiFallback: {
          rewrites: [{from: /^\/.*$/, to: '/_assets/index.html'}],
        },
      };
}

const minificationPlugins = [
  // This compression-webpack-plugin generates pre-compressed files
  // ending in .gz, to be picked up and served by our internal static media
  // server as well as nginx when paired with the gzip_static module.
  new CompressionPlugin({
    algorithm: 'gzip',
    test: /\.(js|map|css|svg|html|txt|ico|eot|ttf)$/,
  }),
  new OptimizeCssAssetsPlugin(),

  // NOTE: In production mode webpack will automatically minify javascript
  // using the TerserWebpackPlugin.
];

if (IS_PRODUCTION) {
  // NOTE: can't do plugins.push(Array) because webpack/webpack#2217
  minificationPlugins.forEach(function(plugin) {
    appConfig.plugins.push(plugin);
    legacyCssConfig.plugins.push(plugin);
  });
}

module.exports = [appConfig, legacyCssConfig];
