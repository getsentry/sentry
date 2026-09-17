import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import {isCollapsedNode, isEAPSpanNode} from './traceGuards';

export type PinnedAttributeValue = string | number | boolean | null;
export const MULTIPLE_PINNED_VALUES = Symbol('multiple attribute values');
export type PinnedAttributeValues = ReadonlyMap<string, PinnedAttributeValue>;

export function getPinnedAttributeValue(
  node: BaseNode,
  values: PinnedAttributeValues
): {resolved: boolean; value: PinnedAttributeValue | typeof MULTIPLE_PINNED_VALUES} {
  if (isEAPSpanNode(node)) {
    return {value: values.get(node.id) ?? null, resolved: values.has(node.id)};
  }
  if (!isCollapsedNode(node)) {
    return {value: null, resolved: true};
  }

  const members = new Set<BaseNode>();
  const addMember = (member: BaseNode) => {
    if (isEAPSpanNode(member)) {
      members.add(member);
    }
  };
  node.forEachChild(addMember);

  let commonValue: PinnedAttributeValue | typeof MULTIPLE_PINNED_VALUES | undefined;
  let resolved = true;
  for (const member of members) {
    resolved &&= values.has(member.id);
    const value = values.get(member.id) ?? null;
    if (commonValue !== undefined && !Object.is(commonValue, value)) {
      commonValue = MULTIPLE_PINNED_VALUES;
    } else {
      commonValue = value;
    }
  }
  return {value: commonValue ?? null, resolved};
}
