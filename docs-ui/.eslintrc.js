var path = require('path');

module.exports = {
  parserOptions: {
    sourceType: 'module'
  },
  env: {
    node: true,
    es6: true
  },
  settings: {
    'import/resolver': {
      webpack: {
        config: path.join(__dirname, '../.storybook/webpack.config.js')
      }
    },
    'import/extensions': ['.js', '.jsx']
  }
};
