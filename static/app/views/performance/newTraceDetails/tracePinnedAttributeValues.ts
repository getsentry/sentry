import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import {isCollapsedNode, isEAPSpanNode} from './traceGuards';

export type PinnedAttributeValue = string | number | boolean | null;
export const MULTIPLE_PINNED_VALUES = Symbol('multiple attribute values');
export type PinnedAttributeValues = ReadonlyMap<string, PinnedAttributeValue>;

export function getPinnedAttributeValue(
  node: BaseNode,
  values: PinnedAttributeValues
): PinnedAttributeValue | typeof MULTIPLE_PINNED_VALUES {
  if (isEAPSpanNode(node)) {
    return values.get(node.id) ?? null;
  }
  if (!isCollapsedNode(node)) {
    return null;
  }

  const members = new Set<BaseNode>();
  const addMember = (member: BaseNode) => {
    if (isEAPSpanNode(member)) {
      members.add(member);
    }
  };
  node.forEachChild(addMember);

  let commonValue: PinnedAttributeValue | undefined;
  for (const member of members) {
    const value = values.get(member.id) ?? null;
    if (commonValue !== undefined && !Object.is(commonValue, value)) {
      return MULTIPLE_PINNED_VALUES;
    }
    commonValue = value;
  }
  return commonValue ?? null;
}
