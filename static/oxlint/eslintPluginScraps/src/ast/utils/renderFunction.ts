import type {ESTree} from '@oxlint/plugins';

export type RenderFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

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

export function getChildrenRenderFunction(
  node: ESTree.JSXElement
): RenderFunction | null {
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
