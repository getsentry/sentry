// oxlint-disable-next-line import/no-nodejs-modules -- Linter rules run in Node.js.
import path from 'node:path';

import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';

type Options = {
  allowSameFolder?: boolean;
  allowedDepth?: number;
  prefix?: string;
  rootDir?: string;
};

function isInsideRoot(fileName: string, root: string): boolean {
  const relativePath = path.relative(root, fileName);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

function getParentDepth(importPath: string): number {
  let depth = 0;
  for (const segment of importPath.split('/')) {
    if (segment !== '..') {
      break;
    }
    depth += 1;
  }
  return depth;
}

export const noRelativeImportPaths = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require imports from parent directories to use a configured alias',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          allowedDepth: {type: 'number'},
          allowSameFolder: {type: 'boolean'},
          prefix: {type: 'string'},
          rootDir: {type: 'string'},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      absoluteImport: 'Import statements should have an absolute path.',
    },
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    const root = path.resolve(process.cwd(), options.rootDir ?? '');
    const fileName = path.resolve(context.filename);

    return {
      ImportDeclaration(node) {
        if (
          node.source.type !== AST_NODE_TYPES.Literal ||
          typeof node.source.value !== 'string'
        ) {
          return;
        }

        const importPath = node.source.value;
        const sameFolderImport = importPath.startsWith('./');
        const parentImport = importPath.startsWith('../');
        const target = path.resolve(path.dirname(fileName), importPath);
        const disallowedParentImport =
          parentImport &&
          isInsideRoot(fileName, root) &&
          isInsideRoot(target, root) &&
          (options.allowedDepth === undefined ||
            getParentDepth(importPath) > options.allowedDepth);

        if ((!sameFolderImport || options.allowSameFolder) && !disallowedParentImport) {
          return;
        }

        context.report({
          node: node.source,
          messageId: 'absoluteImport',
          fix(fixer) {
            const absoluteImport = [
              options.prefix,
              ...path.relative(root, target).split(path.sep),
            ]
              .filter(Boolean)
              .join('/');
            return fixer.replaceTextRange(
              [node.source.range[0] + 1, node.source.range[1] - 1],
              absoluteImport
            );
          },
        });
      },
    };
  },
});
