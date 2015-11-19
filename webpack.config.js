/*eslint-env node*/
var path = require("path"),
    webpack = require("webpack"),
    ExtractTextPlugin = require("extract-text-webpack-plugin");

var staticPrefix = "src/sentry/static/sentry",
    distPath = staticPrefix + "/dist";

// this is set by setup.py sdist
if (process.env.SENTRY_STATIC_DIST_PATH) {
    distPath = process.env.SENTRY_STATIC_DIST_PATH;
}

var config = {
  context: path.join(__dirname, staticPrefix),
  entry: {
    // js
    "app": "app",
    "translations": [
      "app/translations"
    ],
    "vendor": [
      "babel-core/polyfill",
      "bootstrap/js/dropdown",
      "bootstrap/js/tab",
      "bootstrap/js/tooltip",
      "bootstrap/js/alert",
      "crypto-js/md5",
      "jed",
      "jquery",
      "marked",
      "moment",
      "moment-timezone",
      "raven-js",
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
        exclude: /(vendor|node_modules)/,
        query: {
          plugins: ['babel-gettext-extractor'],
          extra: {
            gettext: {
              fileName: 'build/javascript.po',
              baseDirectory: path.join(__dirname, 'src/sentry'),
              functionNames: {
                gettext: ["msgid"],
                ngettext: ["msgid", "msgid_plural", "count"],
                t: ["msgid"],
                tn: ["msgid", "msgid_plural", "count"],
              },
            }
          }
        }
      },
      {
        test: /\.po$/,
        loader: 'po-catalog-loader',
        query: {
          referenceExtensions: ['.js', '.jsx']
        }
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
        loader: 'file-loader?name=' + '[name].[ext]'
      }
    ]
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin("vendor", "vendor.js"),
    new webpack.optimize.DedupePlugin(),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      "window.jQuery": "jquery",
      "root.jQuery": "jquery",
      Raven: "raven-js"
    }),
    new ExtractTextPlugin("[name].css")
  ],
  resolve: {
    alias: {
      "flot": path.join(__dirname, staticPrefix, "vendor", "jquery-flot"),
      "flot-tooltip": path.join(__dirname, staticPrefix, "vendor", "jquery-flot-tooltip")
    },
    modulesDirectories: [path.join(__dirname, staticPrefix), "node_modules"],
    extensions: ["", ".jsx", ".js", ".json"]
  },
  output: {
    path: distPath,
    filename: "[name].js",
    libraryTarget: "var",
    library: "exports",
    sourceMapFilename: "[name].js.map",
  },
  devtool: 'source-map'
};

module.exports = config;
