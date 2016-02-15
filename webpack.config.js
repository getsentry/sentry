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

var babelQuery = {
  plugins: [],
  extra: {}
};

// only extract po files if we need to
if (process.env.SENTRY_EXTRACT_TRANSLATIONS === '1') {
  babelQuery.plugins.push('babel-gettext-extractor');
  babelQuery.extra.gettext = {
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
  };
}

var entry = {
  // js
  'app': 'app',
  'vendor': [
    'babel-core/polyfill',
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
    'react-bootstrap',
    'reflux',
    'select2',
    'flot/jquery.flot',
    'flot/jquery.flot.stack',
    'flot/jquery.flot.time',
    'flot-tooltip/jquery.flot.tooltip',
    'vendor/simple-slider/simple-slider'
  ],

  // css
  // NOTE: this will also create an empty 'sentry.js' file
  // TODO: figure out how to not generate this
  'sentry': 'less/sentry.less'
};

// dynamically iterate over locale files and add to `entry` config
var localeCatalogPath = path.join('src', 'sentry', 'locale', 'catalogs.json');
var localeCatalog = JSON.parse(fs.readFileSync(localeCatalogPath, 'utf8'));

localeCatalog.supported_locales.forEach(function (locale) {
  if (locale === 'en')
    return;

  // Django locale names are "zh_CN", moment's are "zh-cn"
  var module = 'moment/locale/' + locale.toLowerCase().replace('_', '-');
  entry[module] = [module];
});

var config = {
  entry: entry,
  context: path.join(__dirname, staticPrefix),
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        include: path.join(__dirname, staticPrefix),
        exclude: /(vendor|node_modules)/,
        query: babelQuery
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
        loader: ExtractTextPlugin.extract('style-loader', 'css-loader!less-loader')
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
        loader: 'file-loader?name=' + '[name].[ext]'
      }
    ]
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin('vendor', 'vendor.js'),
    new webpack.optimize.DedupePlugin(),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
      'root.jQuery': 'jquery',
      Raven: 'raven-js'
    }),
    new ExtractTextPlugin('[name].css'),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/), // ignore moment.js locale files

    // restrict translation files pulled into dist/app.js to only those specified
    // in locale/catalogs.json
    new webpack.ContextReplacementPlugin(
      /\.\.\/\.\.\/\.\.\/locale\/$/,
      path.join(__dirname, 'src', 'sentry', 'locale', path.sep),
      true,
      new RegExp('(' + localeCatalog.supported_locales.join('|') + ')\/.*\\.po$')
    )
  ],
  resolve: {
    alias: {
      'flot': path.join(__dirname, staticPrefix, 'vendor', 'jquery-flot'),
      'flot-tooltip': path.join(__dirname, staticPrefix, 'vendor', 'jquery-flot-tooltip')
    },
    modulesDirectories: [path.join(__dirname, staticPrefix), 'node_modules'],
    extensions: ['', '.jsx', '.js', '.json']
  },
  output: {
    path: distPath,
    filename: '[name].js',
    libraryTarget: 'var',
    library: 'exports',
    sourceMapFilename: '[name].js.map',
  },
  devtool: 'source-map'
};

module.exports = config;
