import {defineRule} from '@oxlint/plugins';

export const noGlobalReact = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explicit imports for React types and values.',
    },
    schema: [],
    messages: {
      forbidden:
        'Import React explicitly from "react" instead of using its global UMD namespace.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const scope = context.sourceCode.getScope(node);
        const react = scope.set.get('React');
        const references = [
          ...scope.through,
          ...(react && !react.defs.length ? react.references : []),
        ];

        // Include type references, which no-restricted-globals ignores.
        for (const reference of references) {
          if (reference.identifier.name === 'React') {
            context.report({node: reference.identifier, messageId: 'forbidden'});
          }
        }
      },
    };
  },
});
