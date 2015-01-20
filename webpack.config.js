var path = require("path"),
    webpack = require("webpack");

var staticPrefix = "src/sentry/static/sentry",
    distPath = staticPrefix + "/dist";

function file(name) {
  return path.join(__dirname, staticPrefix, name);
}

function vendorFile(name) {
  return path.join(__dirname, staticPrefix, "vendor", name);
}

module.exports = {
  entry: {
    "app": file("app/main.jsx"),
    "vendor": [
      "flot",
      "flot/jquery.flot.resize",
      "flot/jquery.flot.time",
      "jquery",
      "moment",

      "raven",
      "react/addons",
      "react-router",
      "react-bootstrap",
      "reflux"
    ]
  },
  module: {
    loaders: [
      {
        test: /\.jsx$/,
        loader: "jsx-loader?insertPragma=React.DOM&harmony"
      }
    ]
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
      filename: distPath + "/vendor.js",
    }),
    new webpack.optimize.UglifyJsPlugin(),
    new webpack.optimize.DedupePlugin(),
    new webpack.ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery',
    })
  ],
  resolve: {
    modulesDirectories: [distPath, "node_modules"],
    extensions: ["", ".jsx", ".js", ".json"]
  },
  output: {
    filename: distPath + "/[name].js",
    libraryTarget: "var",
    library: "exports"
  },
  devtool: 'source-map'
}
