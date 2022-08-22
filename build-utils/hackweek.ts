/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import {RuntimeModule, Template} from 'webpack';

class SentryRuntimeModule extends RuntimeModule {
  constructor() {
    super('Sentry Hackweek Stuff');
  }

  generate() {
    // const {compilation} = this;
    // const {/*runtimeTemplate*/, outputOptions} = compilation;
    /*
    const {
      scriptType,
      chunkLoadTimeout: loadTimeout,
      crossOriginLoading,
      uniqueName,
      charset,
    } = outputOptions;
    */
    // const fn = RuntimeGlobals.loadScript;

    // const proxy = new Proxy(Module, {
    //   get(target, prop, receiver) {
    //     const prim = Reflect.get(target, prop);
    //     if (typeof prim !== 'function') {
    //       return prim;
    //     }
    //
    //     return new Proxy(prim, {
    //       apply: function (tgt, thisArg, args) {
    //         console.log('Function called: ', prop);
    //         return tgt.apply(thisArg, args);
    //       },
    //     });
    //   },
    // });

    return Template.asString([
      "if (typeof __webpack_require__ === 'undefined') { return; }",
      '__webpack_require__ = new Proxy(__webpack_require__, {',
      Template.indent([
        'apply: function(target, thisArg, argumentsList) {',
        Template.indent([
          'const result = target.apply(thisArg, argumentsList);',
          "if (argumentsList[0].indexOf('node_modules')>-1 || argumentsList[0].indexOf('./app/views') === -1) {",
          'return result;',
          '}',
          "if (typeof result !== 'object') { return result; }",
          'try {',
          'return new Proxy(result, {',
          Template.indent([
            'get(target, prop, receiver) {',
            Template.indent([
              'const prim = Reflect.get(target, prop);',

              "if (typeof prim !== 'function') {",
              '    return prim;',
              '}',

              'try {',
              'return new Proxy(prim, {',
              '    apply: function(tgt, thisArg, args) {',
              "        console.log('Function called: ', argumentsList[0], tgt.name || prop);",
              '        return tgt.apply(thisArg, args);',
              '    }',
              '});',
              '} catch(err) {',
              'console.log(typeof prim);',
              'return prim;',
              '}',
            ]),
            '},',
          ]),
          '});',
          '} catch(err) {',
          'console.error(err);',
          'return result;',
          '}',
        ]),
        '},',
      ]),
      '});',
    ]);
    // return Template.asString([
    //   '__webpack_require__ = new Proxy(__webpack_require__, {',
    //   Template.indent([
    //     'apply: function(target, thisArg, argumentsList) {',
    //     Template.indent([
    //       'var result = target.apply(thisArg, argumentsList);',
    //       'console.log("hello", argumentsList[0], result);',
    //       'return result;',
    //     ]),
    //     '}',
    //   ]),
    //   '});',
    // ]);
  }
}

class HackweekPlugin {
  constructor() {}

  apply(compiler) {
    compiler.hooks.compilation.tap('RuntimePlugin', compilation => {
      compilation.hooks.additionalTreeRuntimeRequirements.tap(
        'RuntimePlugin',
        (chunk, set) => {
          compilation.addRuntimeModule(chunk, new SentryRuntimeModule());
        }
      );
    });

    // compiler.hooks.compilation.tap('RuntimePlugin', compilation => {
    //   compilation.hooks.runtimeRequirementInModule
    //     .for(RuntimeGlobals.require)
    //     .tap('RuntimePlugin', (module, set) => {
    //       // set.add(RuntimeGlobals.requireScope);
    //       console.log('runtimeplugin', module);
    //     });
    //
    //   // compilation.hooks.runtimeRequirementInTree
    //   //   .for(RuntimeGlobals.getChunkScriptFilename)
    //   //   .tap('RuntimePlugin', (chunk, set) => {
    //   //     console.log('runtime plugin', chunk);
    //   //   });
    // });

    // compiler.hooks.normalModuleFactory.tap('MyPlugin', factory => {
    //   factory.hooks.parser.for('javascript/auto').tap('MyPlugin', (parser, options) => {
        // parser.hooks.exportDeclaration.tap('MyPlugin', (statement, declaration) => {
        //   // console.log({statement, declaration});
        //
        //   return statement;
        // });
    //   });
    // });
  }
}

export default HackweekPlugin;
