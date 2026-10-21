import type {ESTree} from '@oxlint/plugins';

export function isTypeWrapper(
  node: ESTree.Node
): node is
  | ESTree.TSAsExpression
  | ESTree.TSSatisfiesExpression
  | ESTree.TSNonNullExpression
  | ESTree.TSTypeAssertion {
  return (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  );
}

export function unwrapTypeWrappers(node: ESTree.Node): ESTree.Node {
  while (isTypeWrapper(node)) {
    node = node.expression;
  }
  return node;
}
