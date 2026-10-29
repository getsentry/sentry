const {createRequire} = require('node:module');
const path = require('node:path');
const {createTransformer} = require('@swc/jest');
const yakRequire = createRequire(require.resolve('@yak/react'));
const {transformSync} = yakRequire('@swc/core');
const plugin = yakRequire.resolve('@yak/swc');

module.exports = {
  createTransformer(options) {
    const fallback = createTransformer(options);
    return {
      ...fallback,
      process(source, filename, config) {
        if (
          !filename.includes('node_modules') &&
          /from ['"]@yak\/react['"]/.test(source)
        ) {
          const result = transformSync(source, {
            filename,
            jsc: {
              target: 'es2022',
              parser: {syntax: 'typescript', tsx: filename.endsWith('tsx')},
              transform: {react: {runtime: 'preserve'}},
              experimental: {
                plugins: [
                  [
                    plugin,
                    {
                      basePath: path.resolve(__dirname, '..'),
                      minify: false,
                      foldStatic: false,
                      strictCssProp: false,
                      importMode: {value: 'data:text/css;base64,', encoding: 'Base64'},
                    },
                  ],
                ],
              },
            },
          });
          // DOM tests use the real compiled components. Browser checks cover CSS.
          source = result.code.replace(
            /import ["']data:text\/css;base64,[^"']*["'];?/g,
            ''
          );
        }
        return fallback.process(source, filename, config);
      },
    };
  },
};
