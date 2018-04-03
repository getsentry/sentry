const path = require('path');
const fs = require('fs');

module.exports = {
  process(src, filename, config, options) {
    const file = fs.readFileSync(filename, 'utf8').replace(/[\r\n]+/g, '');
    const result = file.match(/<svg.*viewBox="([^"]+)".*?>(.*)<\/svg>/);
    const viewBox = (result && result[1]) || '';
    const svg = (result && result[2]) || '';
    return `module.exports = {
        viewBox: "${viewBox}",
        svg: \`${svg}\`,
    }`;
  },
};
