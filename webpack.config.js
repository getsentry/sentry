/*eslint-env node*/
/*eslint no-var:0 import/no-nodejs-modules:0 */
var path = require('path'),
  fs = require('fs'),
  webpack = require('webpack'),
  ExtractTextPlugin = require('extract-text-webpack-plugin'),
  LodashModuleReplacementPlugin = require('lodash-webpack-plugin');

var staticPrefix = 'src/sentry/static/sentry',
  distPath = path.join(__dirname, staticPrefix, 'dist');

// this is set by setup.py sdist
if (process.env.SENTRY_STATIC_DIST_PATH) {
  distPath = process.env.SENTRY_STATIC_DIST_PATH;
}

var IS_PRODUCTION = process.env.NODE_ENV === 'production';
var IS_TEST = process.env.NODE_ENV === 'test' || process.env.TEST_SUITE;
var WEBPACK_DEV_PORT = process.env.WEBPACK_DEV_PORT;
var SENTRY_DEVSERVER_PORT = process.env.SENTRY_DEVSERVER_PORT;
var USE_HOT_MODULE_RELOAD = !IS_PRODUCTION && WEBPACK_DEV_PORT && SENTRY_DEVSERVER_PORT;
var WITH_CSS_SOURCEMAPS = !!process.env.WITH_CSS_SOURCEMAPS || IS_PRODUCTION;

var babelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '.babelrc')));
babelConfig.cacheDirectory = true;

// only extract po files if we need to
if (process.env.SENTRY_EXTRACT_TRANSLATIONS === '1') {
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

var appEntry = {
  app: ['app'],
  vendor: [
    'babel-polyfill',
    'bootstrap/js/dropdown',
    'bootstrap/js/tab',
    'bootstrap/js/tooltip',
    'bootstrap/js/alert',
    'create-react-class',
    'jed',
    'jquery',
    'marked',
    'moment',
    'moment-timezone',
    '@sentry/browser',
    'react',
    'react-dom',
    'react-dom/server',
    'react-document-title',
    'react-router',
    'react-bootstrap/lib/Modal',
    'reflux',
    'vendor/simple-slider/simple-slider',
    'emotion',
    'react-emotion',
    'grid-emotion',
    'emotion-theming',
  ],
};

// dynamically iterate over locale files and add to `entry` appConfig
var localeCatalogPath = path.join(__dirname, 'src', 'sentry', 'locale', 'catalogs.json');
var localeCatalog = JSON.parse(fs.readFileSync(localeCatalogPath, 'utf8'));
var localeEntries = [];

localeCatalog.supported_locales.forEach(function(locale) {
  if (locale === 'en') return;

  // Django locale names are "zh_CN", moment's are "zh-cn"
  var normalizedLocale = locale.toLowerCase().replace('_', '-');
  appEntry['locale/' + normalizedLocale] = [
    'moment/locale/' + normalizedLocale,
    'sentry-locale/' + locale + '/LC_MESSAGES/django.po', // relative to static/sentry
  ];
  localeEntries.push('locale/' + normalizedLocale);
});

/**
 * Main Webpack config for Sentry React SPA.
 */
var appConfig = {
  entry: appEntry,
  context: path.join(__dirname, staticPrefix),
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        include: path.join(__dirname, staticPrefix),
        exclude: /(vendor|node_modules|dist)/,
        query: babelConfig,
      },
      {
        test: /\.po$/,
        loader: 'po-catalog-loader',
        query: {
          referenceExtensions: ['.js', '.jsx'],
          domain: 'sentry',
        },
      },
      {
        test: /app\/icons\/.*\.svg$/,
        use: [
          {
            loader: 'svg-sprite-loader',
          },
          {
            loader: 'svgo-loader',
          },
        ],
      },
      {
        test: /\.css/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              minimize: IS_PRODUCTION,
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
        exclude: /app\/icons\/.*\.svg$/,
        loader: 'file-loader?name=' + '[name].[ext]',
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
    new LodashModuleReplacementPlugin({
      collections: true,
      currying: true, // these are enabled to support lodash/fp/ features
      flattening: true, // used by a dependency of react-mentions
      shorthands: true,
    }),
    new webpack.optimize.CommonsChunkPlugin({
      names: localeEntries.concat(['vendor']), // 'vendor' must be last entry
    }),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
      'root.jQuery': 'jquery',
    }),
    new ExtractTextPlugin('[name].css'),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/), // ignore moment.js locale files
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
        IS_PERCY: JSON.stringify(
          process.env.CI && !!process.env.PERCY_TOKEN && !!process.env.TRAVIS
        ),
      },
    }),
    // restrict translation files pulled into dist/app.js to only those specified
    // in locale/catalogs.json
    new webpack.ContextReplacementPlugin(
      /locale$/,
      path.join(__dirname, 'src', 'sentry', 'locale', path.sep),
      true,
      new RegExp('(' + localeCatalog.supported_locales.join('|') + ')/.*\\.po$')
    ),
  ],
  resolve: {
    alias: {
      app: path.join(__dirname, 'src', 'sentry', 'static', 'sentry', 'app'),
      'app-test': path.join(__dirname, 'tests', 'js'),
      'sentry-locale': path.join(__dirname, 'src', 'sentry', 'locale'),
      'integration-docs-platforms': IS_TEST
        ? path.join(__dirname, 'tests/fixtures/integration-docs/_platforms.json')
        : path.join(__dirname, 'src/sentry/integration-docs/_platforms.json'),
    },
    modules: [path.join(__dirname, staticPrefix), 'node_modules'],
    extensions: ['.jsx', '.js', '.json'],
  },
  output: {
    path: distPath,
    filename: '[name].js',
    libraryTarget: 'var',
    library: 'exports',
    sourceMapFilename: '[name].js.map',
  },
  devtool: IS_PRODUCTION ? '#source-map' : '#cheap-module-eval-source-map',
};

/**
 * Webpack entry for password strength checker
 */
var pwConfig = {
  entry: {
    pwstrength: './index',
  },
  context: path.resolve(path.join(__dirname, staticPrefix), 'js', 'pwstrength'),
  module: {},
  plugins: [],
  resolve: {
    modules: [path.join(__dirname, staticPrefix), 'node_modules'],
    extensions: ['.js'],
  },
  output: {
    path: distPath,
    filename: '[name].js',
    libraryTarget: 'window',
    library: 'sentrypw',
    sourceMapFilename: '[name].js.map',
  },
  devtool: IS_PRODUCTION ? '#source-map' : '#cheap-source-map',
};

/**
 * Legacy CSS Webpack appConfig for Django-powered views.
 * This generates a single "sentry.css" file that imports ALL component styles
 * for use on Django-powered pages.
 */
var legacyCssConfig = {
  entry: {
    sentry: 'less/sentry.less',

    // Below is for old plugins that use select2 when creating a new issue for a plugin
    // e.g. Trello, Teamwork
    select2: 'less/select2.less',
  },
  context: path.join(__dirname, staticPrefix),
  output: {
    path: distPath,
    filename: '[name].css',
  },
  plugins: [new ExtractTextPlugin('[name].css')],
  resolve: {
    extensions: ['.less', '.js'],
    modules: [path.join(__dirname, staticPrefix), 'node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.less$/,
        include: path.join(__dirname, staticPrefix),
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader?sourceMap=false',
          use: [
            {
              loader: 'css-loader',
              options: {
                sourceMap: WITH_CSS_SOURCEMAPS,
                minimize: IS_PRODUCTION,
              },
            },
            {
              loader: 'less-loader',
              options: {
                sourceMap: WITH_CSS_SOURCEMAPS,
              },
            },
          ],
        }),
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
        loader: 'file-loader?name=' + '[name].[ext]',
      },
    ],
  },
  devtool: WITH_CSS_SOURCEMAPS ? '#source-map' : undefined,
};

// Dev only! Hot module reloading
if (USE_HOT_MODULE_RELOAD) {
  // Otherwise with hot reloads we get module ID number
  appConfig.plugins.push(new webpack.NamedModulesPlugin());

  // HMR
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
    port: WEBPACK_DEV_PORT,
  };

  // Required, without this we get this on updates:
  // [HMR] Update failed: SyntaxError: Unexpected token < in JSON at position 12
  appConfig.output.publicPath = 'http://localhost:' + WEBPACK_DEV_PORT + '/';
}

var minificationPlugins = [
  // This compression-webpack-plugin generates pre-compressed files
  // ending in .gz, to be picked up and served by our internal static media
  // server as well as nginx when paired with the gzip_static module.
  new (require('compression-webpack-plugin'))({
    algorithm: function(buffer, options, callback) {
      require('zlib').gzip(buffer, callback);
    },
    regExp: /\.(js|map|css|svg|html|txt|ico|eot|ttf)$/,
  }),

  // Disable annoying UglifyJS warnings that pollute Travis log output
  // NOTE: This breaks -p in webpack 2. Must call webpack w/ NODE_ENV=production for minification.
  new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false,
    },
    // https://github.com/webpack/webpack/blob/951a7603d279c93c936e4b8b801a355dc3e26292/bin/convert-argv.js#L442
    sourceMap:
      appConfig.devtool &&
      (appConfig.devtool.indexOf('sourcemap') >= 0 ||
        appConfig.devtool.indexOf('source-map') >= 0),
  }),
];

if (IS_PRODUCTION) {
  // NOTE: can't do plugins.push(Array) because webpack/webpack#2217
  minificationPlugins.forEach(function(plugin) {
    appConfig.plugins.push(plugin);
    pwConfig.plugins.push(plugin);
    legacyCssConfig.plugins.push(plugin);
  });
}

module.exports = [appConfig, legacyCssConfig, pwConfig];
