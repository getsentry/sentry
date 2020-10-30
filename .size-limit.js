module.exports = [
  {
    path: ['public/app.js'],
    limit: '500KB',
    webpack: false,
    gzip: true,
    brotli: false,
  },
  {
    path: ['public/vendor.js'],
    limit: '1.0MB',
    webpack: false,
    gzip: true,
    brotli: false,
  },
  {
    path: ['public/sentry.css'],
    limit: '50KB',
    webpack: false,
    gzip: true,
    brotli: false,
  },
];
