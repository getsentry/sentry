/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */

/**
 * When our locales are codesplit into cache groups, webpack expects that all
 * chunks *must* be loaded before the main entrypoint can be executed. However,
 * since we will only be using one locale at a time we do not want to load all
 * locale chunks, just the one the user has enabled.
 *
 * This plugin removes the locale chunks from the app entrypoint's immediate
 * chunk dependants list, ensuring that the compiled entrypoint will execute
 * *without* all locale chunks loaded.
 */
const PLUGIN_NAME = 'OptionalLocaleChunkPlugin';

const clearLocaleChunks = chunks =>
  chunks
    .filter(chunk => chunk.name !== 'app')
    .forEach(chunk => {
      const mainGroup = Array.from(chunk.groupsIterable)[0];
      mainGroup.chunks = mainGroup.chunks.filter(
        c => c.name && !c.name.startsWith('locale')
      );
    });

class OptionalLocaleChunkPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, compilation =>
      compilation.hooks.afterOptimizeChunks.tap(PLUGIN_NAME, clearLocaleChunks)
    );
  }
}

module.exports = OptionalLocaleChunkPlugin;
