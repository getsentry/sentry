const {createHash} = require('node:crypto');

// Yak emits side-effect CSS data imports. Keep them out of JavaScript and
// collect them in the stylesheet that Django already loads.
module.exports = function yakCssLoader(source) {
  const hash = createHash('sha256').update(source).digest('hex');
  this.emitFile(`.yak-css/${hash}.css`, source);
  return 'export {};';
};
