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
      'globalThis["__sentry_calls__"] = globalThis["__sentry_calls__"] || [];',
      'globalThis["__sentry_imports__"] = globalThis["__sentry_imports__"] || [];',
      // 'globalThis["__sentry_calls__2"] = globalThis["__sentry_calls__2"] || [[]];',
      "if (typeof __webpack_require__ === 'undefined') { return; }",
      '__webpack_require__ = new Proxy(__webpack_require__, {',
      Template.indent([
        'apply: function(target, thisArg, argumentsList) {',
        Template.indent([
          'var _module = argumentsList[0];',
          "var _is_node_modules = _module.indexOf('node_modules')>-1;",
          // When __webpack_require__ is called, that means the module was imported
          'if (!_is_node_modules) { __sentry_imports__.push(_module); }',
          // if module is already cached, return cached exports
          'if (__webpack_module_cache__[_module] !== undefined) { return __webpack_module_cache__[_module].exports; }',
          'var result = target.apply(thisArg, argumentsList);',
          // WIP: Ignore node_modules and only include app/views for now
          'if (_is_node_modules) { return result; }',
          `var _ignores = [
            './app/components/tooltip.tsx'


          ]`,
          "if (_module.indexOf('./app/views') === -1) { return result; }",
          "if (typeof result !== 'object') { return result; }",
          'try {',
          'var proxy = new Proxy(result, {',
          Template.indent([
            'get(target, prop, receiver) {',
            Template.indent([
              'var prim = Reflect.get(target, prop);',

              "if (typeof prim !== 'function') {",
              '    return prim;',
              '}',

              'try {',
              'return new Proxy(prim, {',
              '    apply: function(tgt, thisArg, args) {',
              '        var _sentry_hub = Sentry && Sentry.getCurrentHub();',
              '        var _sentry_scope = _sentry_hub && _sentry_hub.getScope();',
              '        var _sentry_transaction = _sentry_scope.getTransaction();',
              '        var _sentry_instr = {file: _module, fn: tgt.name || prop, transaction: _sentry_transaction && _sentry_transaction.name, startTimestamp: (performance.timeOrigin + performance.now())/1000};',
              // '__sentry_calls__2.push([]);',
              // '        if (!__sentry_calls__.length) {',
              // '          __sentry_calls__.push()'
              //
              // '        }',
              // '        var _sentry_last = __sentry_calls__.length ? __sentry_calls__[__sentry_calls__.length - 1] : '
              "        console.log('Function called: ', _module, tgt.name || prop, _sentry_transaction?.name);",
              '        var __result = tgt.apply(thisArg, args);',
              '        _sentry_instr.endTimestamp = (performance.timeOrigin + performance.now()) / 1000;',
              '        __sentry_calls__.push(_sentry_instr);',
              // 'var __call_stack = __sentry_calls__2.pop();',
              // '__sentry_calls__2[__sentry_calls__2.length-1].push({file: _module, fn: tgt.name || prop, transaction: _sentry_transaction && _sentry_transaction.name, stack: __call_stack});',
              '        return __result;',
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
          // overwrite cache
          '__webpack_module_cache__[_module].exports = proxy;',
          'return proxy;',
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
    //       'console.log("hello", _module, result);',
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
        (chunk, _set) => {
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
