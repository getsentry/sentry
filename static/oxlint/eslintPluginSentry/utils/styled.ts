import type {ESTree} from '@oxlint/plugins';

function tagInvolvesName(node: ESTree.Node, name: string): boolean {
  if (node.type === 'Identifier') {
    return node.name === name;
  }
  if (node.type === 'MemberExpression') {
    return tagInvolvesName(node.object, name);
  }
  if (node.type === 'CallExpression') {
    return tagInvolvesName(node.callee, name);
  }
  return false;
}

export function isCssTaggedTemplate(
  node: ESTree.Node
): node is ESTree.TaggedTemplateExpression {
  return node.type === 'TaggedTemplateExpression' && tagInvolvesName(node.tag, 'css');
}

export function isStyledOrCssTemplate(
  node: ESTree.Node | undefined
): node is ESTree.TaggedTemplateExpression {
  if (node?.type !== 'TaggedTemplateExpression') {
    return false;
  }
  const {tag} = node;
  return tagInvolvesName(tag, 'styled') || tagInvolvesName(tag, 'css');
}
