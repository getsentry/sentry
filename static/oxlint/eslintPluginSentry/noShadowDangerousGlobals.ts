import {defineRule, type Definition} from '@oxlint/plugins';

/**
 * Globals whose shadowing silently changes what a call does (browser APIs) or
 * makes code misleading to read (JS built-ins). Deliberately curated: common
 * globals that are idiomatic local names here (`event`, `location`, `name`,
 * `status`, `screen`, ...) are left out.
 */
const DANGEROUS_GLOBALS = new Set([
  // Browser APIs
  'fetch',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'queueMicrotask',
  'structuredClone',
  'localStorage',
  'sessionStorage',
  'window',
  'document',
  'navigator',
  'console',
  // JS built-ins
  'Promise',
  'Error',
  'JSON',
  'Object',
  'Array',
  'Number',
  'String',
  'Boolean',
  'Symbol',
  'Map',
  'Set',
  'Date',
  'Math',
  'RegExp',
  'URL',
  'URLSearchParams',
]);

// Definition kinds that create a runtime value binding. Type aliases,
// interfaces, and enum members are left out because they cannot hide the
// global at a call site.
const VALUE_DEFINITION_TYPES = new Set([
  'CatchClause',
  'ClassName',
  'FunctionName',
  'ImportBinding',
  'Parameter',
  'TSEnumName',
  'TSModuleName',
  'Variable',
]);

export const noShadowDangerousGlobals = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow declaring bindings that shadow dangerous browser or JavaScript globals.',
    },
    schema: [],
    messages: {
      shadowed:
        "'{{name}}' shadows the global '{{name}}'. Inside this scope '{{name}}' no longer refers to the built-in, which can silently break calls to it.",
    },
  },
  create(context) {
    return {
      'Program:exit'() {
        // A class name is bound both in the enclosing scope and in the class's
        // own scope, so the same identifier can appear twice.
        const reported = new Set<Definition['name']>();

        for (const scope of context.sourceCode.scopeManager.scopes) {
          for (const variable of scope.variables) {
            if (!DANGEROUS_GLOBALS.has(variable.name)) {
              continue;
            }

            const definition = variable.defs.find(
              def =>
                VALUE_DEFINITION_TYPES.has(def.type) &&
                !(def.type === 'ImportBinding' && isTypeOnlyImport(def))
            );

            if (definition && !reported.has(definition.name)) {
              reported.add(definition.name);
              context.report({
                node: definition.name,
                messageId: 'shadowed',
                data: {name: variable.name},
              });
            }
          }
        }
      },
    };
  },
});

function isTypeOnlyImport(def: Definition): boolean {
  if (def.parent?.type !== 'ImportDeclaration') {
    return false;
  }
  return (
    def.parent.importKind === 'type' ||
    (def.node.type === 'ImportSpecifier' && def.node.importKind === 'type')
  );
}
