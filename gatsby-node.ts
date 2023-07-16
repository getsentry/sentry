const path = require('path');

exports.onCreateWebpackConfig = ({ actions, loaders, getConfig }) => {
  // const webpackConfig = require('./webpack.config');
  // const babelConfig = require('./babel.config');

  // console.log({wp});

  // actions.setWebpackConfig(webpackConfig);

  const staticPrefix = path.join(__dirname, 'static');
  const sentryDjangoAppPath = path.join(__dirname, 'src/sentry/static/sentry');

  console.log({
    staticPrefix,
    sentryDjangoAppPath,
  });

  actions.setWebpackConfig({
    resolve: {
      // ⚠ Note the '..' in the path because the docz gatsby project lives in the `.docz` directory
      modules: ['node_modules'],
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
    },
  });
};
