const path = require('path');
const {ProgressPlugin} = require('webpack');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const {merge} = require('webpack-merge');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

class HelloAsyncPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('HelloAsyncPlugin', (compilation, callback) => {
      // Do something async...
      setTimeout(function () {
        console.log('Done with async work...');
        callback();
      }, 10000);
    });
  }
}

const deps = require('./package.json').dependencies;

const configMode = env => require(`./configs/webpack.${env.mode}`)(env);

const baseConfig = ({analyze, mode, compress}) => ({
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'http://localhost:3000/',
    clean: true,
  },
  stats: 'minimal',
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.(jpeg|jpg|png|gif|webp|svg)$/i,
        type: 'asset',
      },
    ],
  },
  plugins: [
    analyze && new BundleAnalyzerPlugin(),
    new ProgressPlugin(),
    new HtmlWebPackPlugin({
      template: 'public/index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public/',
          globOptions: {
            ignore: ['**/index.html'],
          },
        },
      ],
    }),
    new ModuleFederationPlugin({
      name: 'remote',
      filename: 'remotePokedex.js',
      remotes: {},
      exposes: {
        './pokeRoot': './src/index.jsx',
        './pokedex': './src/routes/Router.jsx',
        './pokeHome': './src/pages/Home/Home.jsx',
        './pokeProvider': './src/contexts/PokemonProvider.jsx',
      },
      shared: {
        // ...deps,
        react: {
          singleton: true,
          eager: true,
          requiredVersion: deps.react,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: deps['react-dom'],
          eager: true,
        },
      },
    }),
    new HelloAsyncPlugin({options: true}),
    compress &&
      new CompressionPlugin({
        algorithm: 'brotliCompress',
        test: /\.(js|css|html|svg)$/,
      }),
  ].filter(Boolean),
});

module.exports = env => merge(baseConfig(env), configMode(env));
