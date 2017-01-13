/*eslint-env node*/
/*eslint no-var:0*/
var path = require('path'),
    fs = require('fs'),
    webpack = require('webpack'),
    ExtractTextPlugin = require('extract-text-webpack-plugin');

var staticPrefix = 'src/sentry/static/sentry',
    distPath = staticPrefix + '/dist';

// this is set by setup.py sdist
if (process.env.SENTRY_STATIC_DIST_PATH) {
    distPath = process.env.SENTRY_STATIC_DIST_PATH;
}

var IS_PRODUCTION = process.env.NODE_ENV === 'production';

var babelConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '.babelrc'))
);

// only extract po files if we need to
if (process.env.SENTRY_EXTRACT_TRANSLATIONS === '1') {
  babelConfig.plugins.push('babel-gettext-extractor', {
    fileName: 'build/javascript.po',
    baseDirectory: path.join(__dirname, 'src/sentry'),
    functionNames: {
      gettext: ['msgid'],
      ngettext: ['msgid', 'msgid_plural', 'count'],
      gettextComponentTemplate: ['msgid'],
      t: ['msgid'],
      tn: ['msgid', 'msgid_plural', 'count'],
      tct: ['msgid']
    },
  });
}

var entry = {
  // js
  'app': 'app',
  'vendor': [
    'babel-polyfill',
    'bootstrap/js/dropdown',
    'bootstrap/js/tab',
    'bootstrap/js/tooltip',
    'bootstrap/js/alert',
    'crypto-js/md5',
    'jed',
    'jquery',
    'marked',
    'moment',
    'moment-timezone',
    'raven-js',
    'react-document-title',
    'react-router',
    'react-bootstrap/lib/Modal',
    'react-sparklines',
    'reflux',
    'select2',
    'flot/jquery.flot',
    'flot/jquery.flot.stack',
    'flot/jquery.flot.time',
    'flot-tooltip/jquery.flot.tooltip',
    'vendor/simple-slider/simple-slider',
    'underscore',
    'ios-device-list'
  ],

  // css
  // NOTE: this will also create an empty 'sentry.js' file
  // TODO: figure out how to not generate this
  'sentry': 'less/sentry.less'
};

// dynamically iterate over locale files and add to `entry` config
var localeCatalogPath = path.join(__dirname, 'src', 'sentry', 'locale', 'catalogs.json');
var localeCatalog = JSON.parse(fs.readFileSync(localeCatalogPath, 'utf8'));
var localeEntries = [];

localeCatalog.supported_locales.forEach(function (locale) {
  if (locale === 'en')
    return;

  // Django locale names are "zh_CN", moment's are "zh-cn"
  var normalizedLocale = locale.toLowerCase().replace('_', '-');
  entry['locale/' + normalizedLocale] = [
    'moment/locale/' + normalizedLocale,
    'sentry-locale/' + locale + '/LC_MESSAGES/django.po' // relative to static/sentry
  ];
  localeEntries.push('locale/' + normalizedLocale);
});


var config = {
  entry: entry,
  context: path.join(__dirname, staticPrefix),
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        include: path.join(__dirname, staticPrefix),
        exclude: /(vendor|node_modules|dist)/,
        query: babelConfig
      },
      {
        test: /\.po$/,
        loader: 'po-catalog-loader',
        query: {
          referenceExtensions: ['.js', '.jsx'],
          domain: 'sentry'
        }
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.less$/,
        include: path.join(__dirname, staticPrefix),
        loader: ExtractTextPlugin.extract({
          fallbackLoader: 'style-loader',
          loader: 'css-loader' + (IS_PRODUCTION ? '?minimize=true' : '') + '!less-loader'
        })
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
        loader: 'file-loader?name=' + '[name].[ext]'
      }
    ],
    noParse: [
      // don't parse known, pre-built javascript files (improves webpack perf)
      /dist\/jquery\.js/,
      /jed\/jed\.js/,
      /marked\/lib\/marked\.js/
    ],
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      names: localeEntries.concat(['vendor']) // 'vendor' must be last entry
    }),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
      'root.jQuery': 'jquery',
      Raven: 'raven-js',
      underscore: 'underscore',
      _: 'underscore'
    }),
    new ExtractTextPlugin('[name].css'),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/), // ignore moment.js locale files
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV)
      }
    }),
    // restrict translation files pulled into dist/app.js to only those specified
    // in locale/catalogs.json
    new webpack.ContextReplacementPlugin(
      /locale$/,
      path.join(__dirname, 'src', 'sentry', 'locale', path.sep),
      true,
      new RegExp('(' + localeCatalog.supported_locales.join('|') + ')\/.*\\.po$')
    )
  ],
  resolve: {
    alias: {
      'flot': path.join(__dirname, staticPrefix, 'vendor', 'jquery-flot'),
      'flot-tooltip': path.join(__dirname, staticPrefix, 'vendor', 'jquery-flot-tooltip'),
      'sentry-locale': path.join(__dirname, 'src', 'sentry', 'locale')
    },
    modules: [path.join(__dirname, staticPrefix), 'node_modules'],
    extensions: ['*', '.jsx', '.js', '.json']
  },
  output: {
    path: distPath,
    filename: '[name].js',
    libraryTarget: 'var',
    library: 'exports',
    sourceMapFilename: '[name].js.map',
  },
  devtool: IS_PRODUCTION ?
    '#source-map' :
    '#cheap-module-eval-source-map'
};

if (IS_PRODUCTION) {
  // This compression-webpack-plugin generates pre-compressed files
  // ending in .gz, to be picked up and served by our internal static media
  // server as well as nginx when paired with the gzip_static module.
  config.plugins.push(new (require('compression-webpack-plugin'))({
    algorithm: function(buffer, options, callback) {
      require('zlib').gzip(buffer, callback);
    },
    regExp: /\.(js|map|css|svg|html|txt|ico|eot|ttf)$/,
  }));

  // Disable annoying UglifyJS warnings that pollute Travis log output
  // NOTE: This breaks -p in webpack 2. Must call webpack w/ NODE_ENV=production for minification.
  config.plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false
    },
    // https://github.com/webpack/webpack/blob/951a7603d279c93c936e4b8b801a355dc3e26292/bin/convert-argv.js#L442
    sourceMap: config.devtool && (config.devtool.indexOf('sourcemap') >= 0 || config.devtool.indexOf('source-map') >= 0)
  }));
}

module.exports = config;
