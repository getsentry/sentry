/**
 * ESLint rule: no-styled-core
 *
 * Disallows wrapping @sentry/scraps components with styled().
 * Use the component's props API instead.
 */
import type {TSESTree} from '@typescript-eslint/utils';
import {ESLintUtils} from '@typescript-eslint/utils';

import {createImportTracker} from '../ast/tracker/imports';
import {getStyledCallInfo} from '../ast/utils/styled';

interface Options {
  components?: string[];
}

export const noStyledCore = ESLintUtils.RuleCreator.withoutDocs<[Options], 'forbidden'>({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow wrapping @sentry/scraps components with styled(). Use the component props API instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          components: {
            type: 'array',
            items: {type: 'string'},
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        "Do not use `styled()` with core component `{{name}}` from `{{source}}`. Use the component's props API instead.",
    },
  },
  defaultOptions: [{}],
  create(context, [options = {}]) {
    const importTracker = createImportTracker();
    const componentSet = options.components ? new Set(options.components) : null;

    function check(node: TSESTree.TaggedTemplateExpression | TSESTree.CallExpression) {
      const info = getStyledCallInfo(node);
      if (info?.kind !== 'component') {
        return;
      }

      const resolved = importTracker.resolve(info.name);
      if (!resolved?.source.startsWith('@sentry/scraps/')) {
        return;
      }

      if (componentSet && !componentSet.has(resolved.imported)) {
        return;
      }

      context.report({
        node: info.tag,
        messageId: 'forbidden',
        data: {name: info.name, source: resolved.source},
      });
    }

    return {
      ...importTracker.visitors,
      TaggedTemplateExpression: check,
      CallExpression: check,
    };
  },
});
