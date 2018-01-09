const env = process.env.BABEL_ENV || process.env.NODE_ENV || 'development';

var pluginList = [
  env === 'development' ? ['emotion', {sourceMap: true, autoLabel: true}] : 'emotion',
  'transform-decorators-legacy',
  'transform-class-properties',
  'transform-object-rest-spread',
  'transform-runtime',
  'lodash',
  'syntax-dynamic-import',
  'react-hot-loader/babel',
  [
    'babel-plugin-transform-builtin-extend',
    {
      globals: ['Array', 'Error'],
    },
  ],
];
if (env !== 'test') {
  pluginList.push('idx');
}
if (env === 'test') {
  pluginList.push('dynamic-import-node');
}

if (process.env.SENTRY_EXTRACT_TRANSLATIONS === '1') {
  pluginList.push([
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

module.exports = {
  presets: [
    'react',
    [
      'latest',
      {
        es2015: {
          modules: env === 'test' ? 'commonjs' : false,
        },
      },
    ],
  ],
  plugins: pluginList,
};
