import {AST_NODE_TYPES, type TSESTree} from '@typescript-eslint/utils';

function tagInvolvesName(node: TSESTree.Node, name: string): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name === name;
  }
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    return tagInvolvesName(node.object, name);
  }
  if (node.type === AST_NODE_TYPES.CallExpression) {
    return tagInvolvesName(node.callee, name);
  }
  return false;
}

export function isCssTaggedTemplate(
  node: TSESTree.Node
): node is TSESTree.TaggedTemplateExpression {
  return (
    node.type === AST_NODE_TYPES.TaggedTemplateExpression &&
    tagInvolvesName(node.tag, 'css')
  );
}

export function isStyledOrCssTemplate(
  node: TSESTree.Node | undefined
): node is TSESTree.TaggedTemplateExpression {
  if (node?.type !== AST_NODE_TYPES.TaggedTemplateExpression) {
    return false;
  }
  const {tag} = node;
  return tagInvolvesName(tag, 'styled') || tagInvolvesName(tag, 'css');
}
