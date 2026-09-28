import {defineRule, type ESTree} from '@oxlint/plugins';

import {createImportTracker} from '../ast/tracker/imports.ts';

// These render props receive APIs or state, not props for the rendered JSX element.
const SCRAPS_SOURCE_EXCEPTIONS = new Set([
  '@sentry/scraps/form',
  '@sentry/scraps/slideOverPanel',
]);

function isScrapsSource(source: string): boolean {
  return (
    !SCRAPS_SOURCE_EXCEPTIONS.has(source) &&
    (source === '@sentry/scraps' || source.startsWith('@sentry/scraps/'))
  );
}

type RenderFunction = ESTree.ArrowFunctionExpression | ESTree.Function;
type ImportTracker = ReturnType<typeof createImportTracker>;

function getComponentName(
  nameNode: ESTree.JSXElementName,
  importTracker: ImportTracker
): string | null {
  if (nameNode.type === 'JSXIdentifier') {
    const info = importTracker.resolve(nameNode.name);
    if (!info || !isScrapsSource(info.source) || info.imported === '*') {
      return null;
    }
    return info.imported === 'default' ? nameNode.name : info.imported;
  }

  if (
    nameNode.type === 'JSXMemberExpression' &&
    nameNode.object.type === 'JSXIdentifier'
  ) {
    const info = importTracker.resolve(nameNode.object.name);
    return info?.imported === '*' && isScrapsSource(info.source)
      ? nameNode.property.name
      : null;
  }

  return null;
}

function getRenderFunction(expression: ESTree.JSXExpression): RenderFunction | null {
  if (
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'FunctionExpression'
  ) {
    return expression;
  }

  if (expression.type === 'ParenthesizedExpression') {
    return getRenderFunction(expression.expression);
  }

  return null;
}

function getChildrenRenderFunction(node: ESTree.JSXElement): RenderFunction | null {
  const childrenAttribute = node.openingElement.attributes.find(
    (attribute): attribute is ESTree.JSXAttribute =>
      attribute.type === 'JSXAttribute' &&
      attribute.name.type === 'JSXIdentifier' &&
      attribute.name.name === 'children'
  );

  if (childrenAttribute?.value?.type === 'JSXExpressionContainer') {
    return getRenderFunction(childrenAttribute.value.expression);
  }

  const meaningfulChildren = node.children.filter(child => {
    if (child.type === 'JSXText') {
      return child.value.trim() !== '';
    }
    return !(
      child.type === 'JSXExpressionContainer' &&
      child.expression.type === 'JSXEmptyExpression'
    );
  });

  if (meaningfulChildren.length !== 1) {
    return null;
  }

  const child = meaningfulChildren[0];
  if (child?.type !== 'JSXExpressionContainer') {
    return null;
  }

  return getRenderFunction(child.expression);
}

function getParameterName(parameter: ESTree.ParamPattern | undefined): string | null {
  if (!parameter) {
    return null;
  }

  if (parameter.type === 'TSParameterProperty') {
    return getParameterName(parameter.parameter);
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

function getReturnedElementsFromChildren(
  children: ESTree.JSXChild[]
): ESTree.JSXElement[] {
  const elements: ESTree.JSXElement[] = [];

  for (const child of children) {
    if (child.type === 'JSXElement') {
      elements.push(...getReturnedElements(child));
    } else if (child.type === 'JSXFragment') {
      elements.push(...getReturnedElementsFromChildren(child.children));
    } else if (
      child.type === 'JSXExpressionContainer' &&
      child.expression.type !== 'JSXEmptyExpression'
    ) {
      elements.push(...getReturnedElements(child.expression));
    }
  }

  return elements;
}

function getReturnedElements(expression: ESTree.Expression): ESTree.JSXElement[] {
  switch (expression.type) {
    case 'JSXElement':
      return isReactFragment(expression.openingElement.name)
        ? getReturnedElementsFromChildren(expression.children)
        : [expression];
    case 'JSXFragment':
      return getReturnedElementsFromChildren(expression.children);
    case 'ArrayExpression':
      return expression.elements.flatMap(element =>
        element && element.type !== 'SpreadElement' ? getReturnedElements(element) : []
      );
    case 'ConditionalExpression':
      return [
        ...getReturnedElements(expression.consequent),
        ...getReturnedElements(expression.alternate),
      ];
    case 'LogicalExpression':
      return expression.operator === '&&'
        ? getReturnedElements(expression.right)
        : [
            ...getReturnedElements(expression.left),
            ...getReturnedElements(expression.right),
          ];
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'TSInstantiationExpression':
      return getReturnedElements(expression.expression);
    case 'SequenceExpression':
      return expression.expressions.flatMap(getReturnedElements);
    default:
      return [];
  }
}

function collectReturnedExpressions(
  statement: ESTree.Statement,
  returnedExpressions: ESTree.Expression[]
) {
  switch (statement.type) {
    case 'ReturnStatement':
      if (statement.argument) {
        returnedExpressions.push(statement.argument);
      }
      return;
    case 'BlockStatement':
      collectReturnedExpressionsFromStatements(statement.body, returnedExpressions);
      return;
    case 'IfStatement':
      collectReturnedExpressions(statement.consequent, returnedExpressions);
      if (statement.alternate) {
        collectReturnedExpressions(statement.alternate, returnedExpressions);
      }
      return;
    case 'DoWhileStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'ForStatement':
    case 'WhileStatement':
    case 'WithStatement':
      collectReturnedExpressions(statement.body, returnedExpressions);
      return;
    case 'LabeledStatement':
      collectReturnedExpressions(statement.body, returnedExpressions);
      return;
    case 'SwitchStatement':
      for (const switchCase of statement.cases) {
        collectReturnedExpressionsFromStatements(
          switchCase.consequent,
          returnedExpressions
        );
      }
      return;
    case 'TryStatement':
      collectReturnedExpressions(statement.block, returnedExpressions);
      if (statement.handler) {
        collectReturnedExpressions(statement.handler.body, returnedExpressions);
      }
      if (statement.finalizer) {
        collectReturnedExpressions(statement.finalizer, returnedExpressions);
      }
      return;
    default:
      return;
  }
}

function collectReturnedExpressionsFromStatements(
  statements: ESTree.Statement[],
  returnedExpressions: ESTree.Expression[]
) {
  for (const statement of statements) {
    collectReturnedExpressions(statement, returnedExpressions);
  }
}

function getRenderFunctionReturnedElements(
  renderFunction: RenderFunction
): ESTree.JSXElement[] {
  if (
    renderFunction.type === 'ArrowFunctionExpression' &&
    renderFunction.body.type !== 'BlockStatement'
  ) {
    return getReturnedElements(renderFunction.body);
  }

  if (!renderFunction.body || renderFunction.body.type !== 'BlockStatement') {
    return [];
  }

  const returnedExpressions: ESTree.Expression[] = [];
  collectReturnedExpressionsFromStatements(renderFunction.body.body, returnedExpressions);
  return returnedExpressions.flatMap(getReturnedElements);
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
    const importTracker = createImportTracker();

    return {
      ...importTracker.visitors,

      JSXElement(node) {
        const componentName = getComponentName(node.openingElement.name, importTracker);
        if (!componentName) {
          return;
        }

        const renderFunction = getChildrenRenderFunction(node);
        if (!renderFunction) {
          return;
        }

        if (getRenderFunctionReturnedElements(renderFunction).length === 0) {
          return;
        }

        if (getParameterName(renderFunction.params[0]) === null) {
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
