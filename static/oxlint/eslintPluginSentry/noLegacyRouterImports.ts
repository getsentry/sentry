import {defineRule, type ESTree} from '@oxlint/plugins';

const legacyPackages = ['react-router-dom', '@remix-run/router', 'react-router/dist'];
const jestModuleMethods = new Set([
  'mock',
  'doMock',
  'unmock',
  'deepUnmock',
  'requireActual',
  'requireMock',
  'setMock',
  'unstable_mockModule',
  'unstable_unmockModule',
]);

export const noLegacyRouterImports = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require React Router V8 package paths while using the V6 runtime.',
    },
    schema: [],
    messages: {
      legacyPath:
        'Use react-router or react-router/dom instead of {{path}}. V8 package paths resolve to the V6 compatibility implementation.',
    },
  },
  create(context) {
    function checkSource(source: ESTree.Node | null | undefined) {
      let importPath: string | undefined;
      if (source?.type === 'Literal' && typeof source.value === 'string') {
        importPath = source.value;
      } else if (source?.type === 'TemplateLiteral' && source.expressions.length === 0) {
        importPath = source.quasis[0]?.value.cooked ?? undefined;
      }

      if (
        !source ||
        !importPath ||
        !legacyPackages.some(
          legacy => importPath === legacy || importPath.startsWith(`${legacy}/`)
        )
      ) {
        return;
      }

      // Moving RouterProvider or internal router exports requires choosing an
      // entrypoint or renaming symbols, so a path-only autofix would be unsafe.
      context.report({node: source, messageId: 'legacyPath', data: {path: importPath}});
    }

    return {
      ImportDeclaration(node) {
        checkSource(node.source);
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source);
      },
      ExportAllDeclaration(node) {
        checkSource(node.source);
      },
      ImportExpression(node) {
        checkSource(node.source);
      },
      TSImportType(node) {
        checkSource(node.source);
      },
      TSExternalModuleReference(node) {
        checkSource(node.expression);
      },
      CallExpression(node) {
        const {callee} = node;
        if (callee.type === 'Identifier' && callee.name === 'require') {
          checkSource(node.arguments[0]);
          return;
        }

        if (callee.type !== 'MemberExpression' || callee.object.type !== 'Identifier') {
          return;
        }

        const method =
          !callee.computed && callee.property.type === 'Identifier'
            ? callee.property.name
            : callee.property.type === 'Literal' &&
                typeof callee.property.value === 'string'
              ? callee.property.value
              : undefined;

        if (
          (callee.object.name === 'jest' && method && jestModuleMethods.has(method)) ||
          (callee.object.name === 'require' && method === 'resolve')
        ) {
          checkSource(node.arguments[0]);
        }
      },
    };
  },
});
