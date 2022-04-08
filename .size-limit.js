module.exports = [
  {
    path: ['src/sentry/static/sentry/dist/entrypoints/app.js'],
    limit: '220KB',
    webpack: false,
    gzip: true,
    brotli: false,
  },
  {
    path: ['src/sentry/static/sentry/dist/entrypoints/sentry.css'],
    limit: '270KB',
    webpack: false,
    gzip: true,
    brotli: false,
  },
];
