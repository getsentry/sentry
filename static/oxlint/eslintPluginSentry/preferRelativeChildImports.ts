// oxlint-disable-next-line import/no-nodejs-modules -- Linter rules run in Node.js.
import path from 'node:path';

import {defineRule} from '@oxlint/plugins';

type Options = {
  prefix?: string;
  rootDir?: string;
};

export const preferRelativeChildImports = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer relative imports for files in the same directory or below',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          prefix: {type: 'string'},
          rootDir: {type: 'string'},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      relativeImport: 'Use a relative import for files in the same directory or below.',
    },
  },
  create(context) {
    if (context.filename === '<input>' || context.filename === '<text>') {
      return {};
    }

    const options = (context.options[0] ?? {}) as Options;
    const root = path.resolve(process.cwd(), options.rootDir ?? 'static/app');
    const directory = path.relative(root, path.dirname(path.resolve(context.filename)));
    if (
      directory === '..' ||
      directory.startsWith(`..${path.sep}`) ||
      path.isAbsolute(directory)
    ) {
      return {};
    }

    const directoryAlias = [options.prefix ?? 'sentry', ...directory.split(path.sep)]
      .filter(Boolean)
      .join('/');

    return {
      ImportDeclaration(node) {
        if (node.source.type !== 'Literal' || typeof node.source.value !== 'string') {
          return;
        }

        const importPath = node.source.value;
        if (!importPath.startsWith(`${directoryAlias}/`)) {
          return;
        }

        const suffix = importPath.slice(directoryAlias.length + 1);
        if (
          suffix
            .split('/')
            .some(segment => segment === '' || segment === '.' || segment === '..')
        ) {
          return;
        }

        context.report({
          node: node.source,
          messageId: 'relativeImport',
          fix(fixer) {
            return fixer.replaceText(node.source, JSON.stringify(`./${suffix}`));
          },
        });
      },
    };
  },
});
