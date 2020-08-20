module.exports = [
  {
    path: ['public/app.js'],
    limit: '1.6MB',
    webpack: false,
    gzip: true,
    brotli: false,
  },
  {
    path: ['public/vendor.js'],
    limit: '4.0MB',
    webpack: false,
    gzip: true,
    brotli: false,
  },
];
