/*eslint-env node*/
var path = require("path"),
    webpack = require("webpack"),
    ManifestPlugin = require('webpack-manifest-plugin'),
    ExtractTextPlugin = require("extract-text-webpack-plugin");

var staticPrefix = "src/sentry/static/sentry",
    distPath = staticPrefix + "/dist";

// Changes a webpack filename config depending on
// the deployment environment.
//
// e.g.
//   [name].js => [name].[chunkhash].js (in production)
//   [name].js => [name].js (unaltered in dev)

function fileFormatForEnv(file, attr) {
  attr = attr || '[chunkhash]';
  return process.env.NODE_ENV === 'production' ?
    file.replace(/\.([\w\[\]]+)$/, '.' + attr + '.$1') :
    file;
}

var config = {
  context: path.join(__dirname, staticPrefix),
  entry: {
    // js
    "app": "app",
    "vendor": [
      "babel-core/polyfill",
      "bootstrap/js/dropdown",
      "bootstrap/js/tab",
      "bootstrap/js/tooltip",
      "bootstrap/js/alert",
      "crypto-js/md5",
      "jquery",
      "marked",
      "moment",
      "moment-timezone",
      "raven-js",
      "react/addons",
      "react-document-title",
      "react-router",
      "react-bootstrap",
      "reflux",
      "select2",
      "flot/jquery.flot",
      "flot/jquery.flot.stack",
      "flot/jquery.flot.time",
      "flot-tooltip/jquery.flot.tooltip",
      "vendor/simple-slider/simple-slider"
    ],

    // css
    // NOTE: this will also create an empty "sentry.js" file
    // TODO: figure out how to not generate this
    "sentry": "less/sentry.less"

  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: "babel-loader",
        include: path.join(__dirname, staticPrefix),
        exclude: /(vendor|node_modules)/
      },
      {
        test: /\.json$/,
        loader: "json-loader"
      },
      {
        test: /\.less$/,
        include: path.join(__dirname, staticPrefix),
        loader: ExtractTextPlugin.extract("style-loader", "css-loader!less-loader")
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
        loader: 'file-loader?name=' + fileFormatForEnv('[name].[ext]', '[hash]')
      }
    ]
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin("vendor", fileFormatForEnv("vendor.js")),
    new webpack.optimize.DedupePlugin(),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      "window.jQuery": "jquery",
      "root.jQuery": "jquery",
      Raven: "raven-js"
    }),
    new ManifestPlugin(), // writes manifest.json to output directory
    new ExtractTextPlugin(fileFormatForEnv("[name].css"))
  ],
  resolve: {
    alias: {
      "flot": path.join(__dirname, staticPrefix, "vendor", "jquery-flot"),
      "flot-tooltip": path.join(__dirname, staticPrefix, "vendor", "jquery-flot-tooltip"),
    },
    modulesDirectories: [path.join(__dirname, staticPrefix), "node_modules"],
    extensions: ["", ".jsx", ".js", ".json"]
  },
  output: {
    path: distPath,
    filename: fileFormatForEnv("[name].js"),
    libraryTarget: "var",
    library: "exports",
    sourceMapFilename: fileFormatForEnv("[name].js.map"),
  },
  devtool: 'source-map'
};

module.exports = config;
