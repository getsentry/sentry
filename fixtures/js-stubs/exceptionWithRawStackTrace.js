export function ExceptionWithRawStackTrace(params = {}) {
  return {
    platform: 'javascript',
    entries: [
      {
        type: 'exception',
        data: {
          values: [
            {
              type: 'ReferenceError',
              value: 'methodDoesNotExist is not defined',
              stacktrace: {
                frames: [
                  {
                    function: 'sentryWrapped',
                    module: '@sentry/browser/esm/helpers',
                    filename: './node_modules/@sentry/browser/esm/helpers.js',
                    abs_path: 'webpack:///./node_modules/@sentry/browser/esm/helpers.js',
                    lineno: 95,
                    colno: 17,
                    pre_context: [
                      '      }); // Attempt to invoke user-land function',
                      '      // NOTE: If you are a Sentry user, and you are seeing this stack frame, it',
                      '      //       means the sentry.javascript SDK caught an error invoking your application code. This',
                      '      //       is expected behavior and NOT indicative of a bug with sentry.javascript.',
                      '',
                    ],
                    context_line: '      return fn.apply(this, wrappedArguments);',
                    post_context: [
                      '    } catch (ex) {',
                      '      ignoreNextOnError();',
                      '      withScope(function (scope) {',
                      '        scope.addEventProcessor(function (event) {',
                      '          if (options.mechanism) {',
                    ],
                    in_app: false,
                    data: {
                      sourcemap:
                        'https://develop.sentry.dev/app-69b3880622358a8ea89e.js.map',
                    },
                  },
                ],
              },
              rawStacktrace: {
                frames: [
                  {
                    function: 'HTMLDocument.o',
                    filename: '/app-69b3880622358a8ea89e.js',
                    abs_path: 'https://develop.sentry.dev/app-69b3880622358a8ea89e.js',
                    lineno: 5,
                    colno: 133993,
                    pre_context: [
                      '/*! For license information please see app-69b3880622358a8ea89e.js.LICENSE.txt */',
                      '(window.webpackJsonp=window.webpackJsonp||[]).push([[1],{"+924":function(e,t,r){"use strict";r.d(t,"a",(function(){return s})),r.d(t,"b",(fu {snip}',
                      '  color: var(--light-text);',
                      '  line-height: 1.65;',
                    ],
                    context_line:
                      '{snip} ments);var o=n.map((function(e){return ze(e,t)}));return e.apply(this,o)}catch(i){throw Be(),$((function(e){e.addEventProcessor((function(e) {snip}',
                    post_context: [
                      '//# sourceMappingURL=app-69b3880622358a8ea89e.js.map',
                    ],
                    in_app: false,
                  },
                ],
              },
            },
          ],
        },
      },
    ],
    ...params,
  };
}
