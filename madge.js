const madge = require('madge');
const fs = require('node:fs');

madge('static/app/index.tsx', {
  fileExtensions: ['js', 'ts', 'tsx', 'pegjs', 'json'],
  tsConfig: './tsconfig.json',
  webpackConfig: './webpack.config.js',
}).then(async res => {
  fs.writeFileSync('madge', JSON.stringify(res.obj(), null, 2));
  fs.writeFileSync('madge.warning', JSON.stringify(res.warnings(), null, 2));
  fs.writeFileSync('madge.circular', JSON.stringify(res.circular(), null, 2));
  fs.writeFileSync('madge.circularGraph', JSON.stringify(res.circularGraph(), null, 2));
  // fs.writeFileSync('madge.depends', res.depends());
  fs.writeFileSync('madge.orphans', JSON.stringify(res.orphans(), null, 2));
  fs.writeFileSync('madge.leaves', JSON.stringify(res.leaves(), null, 2));
  await res.image('madge.png');
  await res.image('madge.circular.png', true);
  await res.svg('madge.svg');
  await res.svg('madge.circular.svg', true);
});
