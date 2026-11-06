import {defineRule, type ESTree} from '@oxlint/plugins';

function propertyName(property: ESTree.ObjectProperty): string | undefined {
  if (property.computed) {
    return undefined;
  }
  if (property.key.type === 'Identifier') {
    return property.key.name;
  }
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return undefined;
}

export const preferNuqs = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use nuqs for query parameter updates on the current page.',
    },
    schema: [],
    messages: {
      preferNuqs: 'Use nuqs to update query parameters on the current page.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const {callee} = node;
        if (
          !(
            (callee.type === 'Identifier' && callee.name === 'navigate') ||
            (callee.type === 'MemberExpression' &&
              !callee.computed &&
              callee.property.type === 'Identifier' &&
              callee.property.name === 'navigate')
          )
        ) {
          return;
        }

        const [target, options] = node.arguments;
        if (target?.type !== 'ObjectExpression') {
          return;
        }
        if (
          options &&
          (options.type !== 'ObjectExpression' ||
            options.properties.some(
              property =>
                property.type === 'SpreadElement' ||
                propertyName(property) === undefined ||
                propertyName(property) === 'state'
            ))
        ) {
          return;
        }

        let hasQuery = false;
        for (const property of target.properties) {
          if (property.type === 'SpreadElement') {
            if (
              property.argument.type !== 'Identifier' ||
              property.argument.name !== 'location'
            ) {
              return;
            }
            hasQuery = false;
            continue;
          }
          if (property.kind !== 'init' || property.method) {
            return;
          }

          const name = propertyName(property);
          if (name === 'query') {
            hasQuery = true;
            continue;
          }
          const {value} = property;
          if (
            name !== 'pathname' ||
            value.type !== 'MemberExpression' ||
            value.computed ||
            value.object.type !== 'Identifier' ||
            value.object.name !== 'location' ||
            value.property.type !== 'Identifier' ||
            value.property.name !== 'pathname'
          ) {
            return;
          }
        }

        if (hasQuery) {
          context.report({node, messageId: 'preferNuqs'});
        }
      },
    };
  },
});
