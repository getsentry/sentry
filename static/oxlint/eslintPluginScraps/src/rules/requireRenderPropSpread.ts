import {defineRule, type ESTree} from '@oxlint/plugins';

import {createImportTracker} from '../ast/tracker/imports.ts';
import {
  getChildrenRenderFunction,
  type RenderFunction,
} from '../ast/utils/renderFunction.ts';

// These render props receive APIs or state, not props for the rendered JSX element.
const SCRAPS_SOURCE_EXCEPTIONS = new Set([
  '@sentry/scraps/confirm',
  '@sentry/scraps/form',
  '@sentry/scraps/slideOverPanel',
]);

function isScrapsSource(source: string): boolean {
  return (
    !SCRAPS_SOURCE_EXCEPTIONS.has(source) &&
    (source === '@sentry/scraps' || source.startsWith('@sentry/scraps/'))
  );
}

type ImportTracker = ReturnType<typeof createImportTracker>;

function getComponentName(
  nameNode: ESTree.JSXElementName,
  importTracker: ImportTracker
): string | null {
  if (nameNode.type === 'JSXIdentifier') {
    const info = importTracker.resolve(nameNode);
    if (!info || !isScrapsSource(info.source) || info.imported === '*') {
      return null;
    }
    return info.imported === 'default' ? nameNode.name : info.imported;
  }

  if (nameNode.type === 'JSXMemberExpression') {
    const info = importTracker.resolve(nameNode.object);
    return info?.imported === '*' && isScrapsSource(info.source)
      ? nameNode.property.name
      : null;
  }

  return null;
}

function getParameterName(parameter: ESTree.ParamPattern | undefined): string | null {
  if (!parameter) {
    return null;
  }

  if (parameter.type === 'Identifier') {
    return parameter.name;
  }

  if (parameter.type === 'AssignmentPattern') {
    return getParameterName(parameter.left);
  }

  return null;
}

function isReactFragment(nameNode: ESTree.JSXElementName): boolean {
  return (
    (nameNode.type === 'JSXIdentifier' && nameNode.name === 'Fragment') ||
    (nameNode.type === 'JSXMemberExpression' &&
      nameNode.object.type === 'JSXIdentifier' &&
      nameNode.object.name === 'React' &&
      nameNode.property.name === 'Fragment')
  );
}

function childrenReturnElement(children: ESTree.JSXChild[]): boolean {
  return children.some(child =>
    child.type === 'JSXExpressionContainer'
      ? child.expression.type !== 'JSXEmptyExpression' && returnsElement(child.expression)
      : (child.type === 'JSXElement' || child.type === 'JSXFragment') &&
        returnsElement(child)
  );
}

function returnsElement(expression: ESTree.Expression): boolean {
  switch (expression.type) {
    case 'JSXElement':
      return (
        !isReactFragment(expression.openingElement.name) ||
        childrenReturnElement(expression.children)
      );
    case 'JSXFragment':
      return childrenReturnElement(expression.children);
    case 'ArrayExpression':
      return expression.elements.some(
        element =>
          element !== null && element.type !== 'SpreadElement' && returnsElement(element)
      );
    case 'ConditionalExpression':
      return (
        returnsElement(expression.consequent) || returnsElement(expression.alternate)
      );
    case 'LogicalExpression':
      return (
        (expression.operator !== '&&' && returnsElement(expression.left)) ||
        returnsElement(expression.right)
      );
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'TSInstantiationExpression':
      return returnsElement(expression.expression);
    case 'SequenceExpression':
      return expression.expressions.some(returnsElement);
    default:
      return false;
  }
}

function statementReturnsElement(statement: ESTree.Statement): boolean {
  switch (statement.type) {
    case 'ReturnStatement':
      return statement.argument !== null && returnsElement(statement.argument);
    case 'BlockStatement':
      return statement.body.some(statementReturnsElement);
    case 'IfStatement':
      return (
        statementReturnsElement(statement.consequent) ||
        (statement.alternate !== null && statementReturnsElement(statement.alternate))
      );
    case 'DoWhileStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'ForStatement':
    case 'LabeledStatement':
    case 'WhileStatement':
    case 'WithStatement':
      return statementReturnsElement(statement.body);
    case 'SwitchStatement':
      return statement.cases.some(switchCase =>
        switchCase.consequent.some(statementReturnsElement)
      );
    case 'TryStatement':
      return (
        statementReturnsElement(statement.block) ||
        (statement.handler !== null && statementReturnsElement(statement.handler.body)) ||
        (statement.finalizer !== null && statementReturnsElement(statement.finalizer))
      );
    default:
      return false;
  }
}

function renderFunctionReturnsElement({body}: RenderFunction): boolean {
  if (body?.type === 'BlockStatement') {
    return body.body.some(statementReturnsElement);
  }
  return body !== null && returnsElement(body);
}

export const requireRenderPropSpread = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require render props from scraps components to be received as a single props object.',
    },
    schema: [],
    messages: {
      noDestructure:
        'Do not destructure props received by <{{component}}>’s render function.',
    },
  },

  create(context) {
    const importTracker = createImportTracker(context);

    return {
      JSXElement(node) {
        const componentName = getComponentName(node.openingElement.name, importTracker);
        if (!componentName) {
          return;
        }

        const renderFunction = getChildrenRenderFunction(node);
        if (
          renderFunction &&
          getParameterName(renderFunction.params[0]) === null &&
          renderFunctionReturnsElement(renderFunction)
        ) {
          context.report({
            node: renderFunction,
            messageId: 'noDestructure',
            data: {component: componentName},
          });
        }
      },
    };
  },
});
