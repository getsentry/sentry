import {defineRule, type ESTree, type Variable} from '@oxlint/plugins';

import {createImportTracker} from '../ast/tracker/imports.ts';
import {getChildrenRenderFunction} from '../ast/utils/renderFunction.ts';

function isFieldControl(name: string): boolean {
  return /^[A-Z]/.test(name) && name !== 'Layout' && name !== 'Meta';
}

/**
 * Field state and handlers alone do not provide the accessibility, validation,
 * and layout behavior of bound field components. Custom controls need field.Base.
 * Layout and Meta alone do not satisfy this requirement.
 * Checks inline AppField and scraps AutoSaveForm render functions. AppField is
 * identified by its member name because forms and field groups are created locally.
 * Array-mode AppFields manage collections and are exempt; their item fields are checked.
 */
export const requireFieldComponent = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require field render functions to use a bound field component.',
    },
    schema: [],
    messages: {
      missingComponent:
        'Render a component from the field parameter, such as `<field.Input />`. Use `<field.Base />` for a custom control.',
    },
  },
  create(context) {
    if (
      !context.sourceCode.text.includes('AppField') &&
      !context.sourceCode.text.includes('AutoSaveForm')
    ) {
      return {};
    }

    const importTracker = createImportTracker(context);
    const renderedObjects = new Set<Variable>();
    const renderedComponents = new Set<Variable>();

    function usesComponent(
      parameter: ESTree.ParamPattern | undefined,
      destructuredComponent = false
    ): boolean {
      if (!parameter) {
        return false;
      }

      if (parameter.type === 'Identifier') {
        const variable = importTracker.resolveVariable(parameter);
        return (
          variable !== undefined &&
          (destructuredComponent ? renderedComponents : renderedObjects).has(variable)
        );
      }

      if (parameter.type === 'AssignmentPattern') {
        return usesComponent(parameter.left, destructuredComponent);
      }

      if (parameter.type === 'ObjectPattern') {
        return parameter.properties.some(property => {
          if (property.type === 'RestElement') {
            return usesComponent(property.argument, destructuredComponent);
          }

          const key =
            !property.computed && property.key.type === 'Identifier'
              ? property.key.name
              : property.key.type === 'Literal' && typeof property.key.value === 'string'
                ? property.key.value
                : null;
          return (
            key !== null &&
            (destructuredComponent || isFieldControl(key)) &&
            usesComponent(property.value, true)
          );
        });
      }

      return false;
    }

    return {
      ...importTracker.visitors,

      JSXOpeningElement(node) {
        let name = node.name;
        let componentName: string | undefined;
        while (name.type === 'JSXMemberExpression') {
          componentName = name.property.name;
          name = name.object;
        }

        const variable = importTracker.resolveVariable(name);
        if (!variable) {
          return;
        }

        renderedComponents.add(variable);
        if (componentName && isFieldControl(componentName)) {
          renderedObjects.add(variable);
        }
      },

      'JSXElement:exit'(node) {
        const name = node.openingElement.name;
        const isAppField =
          name.type === 'JSXMemberExpression' && name.property.name === 'AppField';
        if (
          !isAppField &&
          !importTracker.is(name, '@sentry/scraps/form', 'AutoSaveForm')
        ) {
          return;
        }

        if (
          isAppField &&
          node.openingElement.attributes.some(attribute => {
            if (
              attribute.type !== 'JSXAttribute' ||
              attribute.name.type !== 'JSXIdentifier' ||
              attribute.name.name !== 'mode'
            ) {
              return false;
            }
            const value =
              attribute.value?.type === 'JSXExpressionContainer'
                ? attribute.value.expression
                : attribute.value;
            return value?.type === 'Literal' && value.value === 'array';
          })
        ) {
          return;
        }

        const renderFunction = getChildrenRenderFunction(node);
        if (renderFunction && !usesComponent(renderFunction.params[0])) {
          context.report({node: renderFunction, messageId: 'missingComponent'});
        }
      },
    };
  },
});
