import type {ReactNode} from 'react';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import type {
  GroupOp,
  HeaderCheckOp,
  HeaderOperand,
  Op,
} from 'sentry/views/alerts/rules/uptime/types';

/**
 * Checks if one op is directly after another op in a container's children array.
 *
 * @param containerOp - The op to search within (must be a logical group with children)
 * @param opId - The ID of the op to check
 * @param afterOpId - The ID of the op that should come before
 * @returns true if opId is directly after afterOpId in the container's children, false otherwise
 */
export function isAfterOp(containerOp: Op, opId: string, afterOpId: string): boolean {
  // Only group ops have children where one can be after another
  if (containerOp.op === 'and' || containerOp.op === 'or') {
    for (let i = 0; i < containerOp.children.length - 1; i++) {
      if (containerOp.children[i]?.id === afterOpId) {
        return containerOp.children[i + 1]?.id === opId;
      }
    }
  }

  // Also check recursively in nested groups
  if (containerOp.op === 'and' || containerOp.op === 'or') {
    return containerOp.children.some(child => isAfterOp(child, opId, afterOpId));
  }

  // Check in not operand
  if (containerOp.op === 'not') {
    return isAfterOp(containerOp.operand, opId, afterOpId);
  }

  return false;
}

/**
 * Finds an op by ID in the op tree and returns it along with its parent.
 *
 * @param op - The op tree to search in
 * @param id - The ID of the op to find
 * @returns An object with the found op and its parent GroupOp, or null if not found
 */
function findOpById(op: Op, id: string): {op: Op; parent: GroupOp | null} | null {
  // Helper function for recursive search
  const search = (
    currentOp: Op,
    parentOp: GroupOp | null
  ): {op: Op; parent: GroupOp | null} | null => {
    if (currentOp.id === id) {
      return {op: currentOp, parent: parentOp};
    }

    if (currentOp.op === 'and' || currentOp.op === 'or') {
      for (const child of currentOp.children) {
        const found = search(child, currentOp);
        if (found) {
          return found;
        }
      }
    }

    if (currentOp.op === 'not') {
      // For 'not' ops, check if the operand is a group op to use as parent
      if (currentOp.operand.op === 'and' || currentOp.operand.op === 'or') {
        return search(currentOp.operand, currentOp.operand);
      }
      return search(currentOp.operand, parentOp);
    }

    return null;
  };

  return search(op, null);
}

/**
 * Checks if an op is an ancestor of another op in the tree.
 *
 * @param op - The op tree to search in
 * @param ancestorId - The ID of the potential ancestor
 * @param descendantId - The ID of the potential descendant
 * @returns true if ancestorId is an ancestor of descendantId
 */
function isAncestorOf(op: Op, ancestorId: string, descendantId: string): boolean {
  // Find the potential ancestor node
  if (op.id === ancestorId) {
    // Check if descendantId exists within this subtree
    const hasDescendant = (node: Op): boolean => {
      if (node.id === descendantId) {
        return true;
      }
      if (node.op === 'and' || node.op === 'or') {
        return node.children.some(child => hasDescendant(child));
      }
      if (node.op === 'not') {
        return hasDescendant(node.operand);
      }
      return false;
    };
    return hasDescendant(op);
  }

  // Continue searching for the ancestor in the tree
  if (op.op === 'and' || op.op === 'or') {
    return op.children.some(child => isAncestorOf(child, ancestorId, descendantId));
  }
  if (op.op === 'not') {
    return isAncestorOf(op.operand, ancestorId, descendantId);
  }

  return false;
}

/**
 * Moves an op from its current position to before, after, or inside a target op.
 *
 * @param rootOp - The root logical op tree
 * @param sourceId - The ID of the op to move
 * @param targetId - The ID of the op to use as reference
 * @param position - Whether to place the source 'before', 'after', or 'inside' the target
 * @returns A new root logical op tree with the source moved to the new position
 */
export function moveTo(
  rootOp: GroupOp,
  sourceId: string,
  targetId: string,
  position: 'before' | 'after' | 'inside'
): GroupOp {
  // First, find and extract the source op
  const sourceResult = findOpById(rootOp, sourceId);
  if (!sourceResult) {
    return rootOp;
  }

  const {op: sourceOp} = sourceResult;

  // Find the target to determine where to insert
  const targetResult = findOpById(rootOp, targetId);
  if (!targetResult) {
    return rootOp;
  }

  // Prevent moving a parent into one of its descendants
  if (isAncestorOf(rootOp, sourceId, targetId)) {
    return rootOp;
  }

  // For 'inside' position, target must be a group op and doesn't need a parent
  if (position === 'inside') {
    const {op: targetOp} = targetResult;
    if (targetOp.op !== 'and' && targetOp.op !== 'or') {
      return rootOp; // Can only move inside group ops
    }
  } else {
    // For 'before' and 'after', target must have a parent
    if (!targetResult.parent) {
      return rootOp; // Target not found or has no parent, return unchanged
    }
  }

  // Remove the source op from its current location
  const removeOp = (op: Op): Op => {
    if (op.op === 'and' || op.op === 'or') {
      const newChildren = op.children
        .filter(child => child.id !== sourceId)
        .map(child => removeOp(child));
      return {...op, children: newChildren};
    }
    if (op.op === 'not') {
      return {...op, operand: removeOp(op.operand)};
    }
    return op;
  };

  // Insert the source op at the target location
  const insertOp = (op: Op): Op => {
    if (op.op === 'and' || op.op === 'or') {
      // Check if we should insert inside this group
      if (position === 'inside' && op.id === targetId) {
        // Append to the end of this group's children
        return {...op, children: [...op.children, sourceOp]};
      }

      // Check if target is a direct child for before/after positioning
      const targetIndex = op.children.findIndex(child => child.id === targetId);
      if (targetIndex !== -1 && position !== 'inside') {
        // Found the target in this container
        const newChildren = [...op.children];
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        newChildren.splice(insertIndex, 0, sourceOp);
        return {...op, children: newChildren};
      }

      // Target not in this container, recurse into children
      return {...op, children: op.children.map(child => insertOp(child))};
    }
    if (op.op === 'not') {
      return {...op, operand: insertOp(op.operand)};
    }
    return op;
  };

  // First remove, then insert
  const withoutSource = removeOp(rootOp);
  return insertOp(withoutSource) as GroupOp;
}

export const HEADER_OPERAND_OPTIONS: Array<
  SelectOption<'literal' | 'glob'> & {symbol: string}
> = [
  {value: 'literal', label: t('Literal'), symbol: '""'},
  {value: 'glob', label: t('Glob Pattern'), symbol: '\u2217'},
];

export function getHeaderOperandValue(operand: HeaderOperand): string {
  return operand.header_op === 'literal'
    ? operand.value
    : operand.header_op === 'glob'
      ? operand.pattern.value
      : '';
}

export function shouldShowHeaderValueInput(op: HeaderCheckOp): boolean {
  return ['equals', 'not_equal'].includes(op.key_op.cmp);
}

export function getHeaderKeyComparisonOptions<T extends {value: string}>(
  options: T[]
): T[] {
  return options.filter(opt => !['less_than', 'greater_than'].includes(opt.value));
}

export function getHeaderValueComparisonOptions<T extends {value: string}>(
  options: T[]
): T[] {
  return options.filter(opt => ['equals', 'not_equal'].includes(opt.value));
}

type HeaderComparisonOption = {symbol: string; value: string; label?: ReactNode};

export function getHeaderKeyCombinedLabelAndTooltip(
  op: HeaderCheckOp,
  headerKeyComparisonOptions: HeaderComparisonOption[]
): {combinedLabel: string; combinedTooltip: string} {
  const keyOperandType = op.key_operand.header_op;

  const keyComparisonLabel =
    headerKeyComparisonOptions.find(opt => opt.value === op.key_op.cmp)?.label ?? '';
  const keyComparisonSymbol =
    headerKeyComparisonOptions.find(opt => opt.value === op.key_op.cmp)?.symbol ?? '';

  const keyOperandLabel =
    keyOperandType === 'none'
      ? ''
      : (HEADER_OPERAND_OPTIONS.find(opt => opt.value === keyOperandType)?.label ?? '');
  const keyOperandSymbol =
    keyOperandType === 'none'
      ? ''
      : (HEADER_OPERAND_OPTIONS.find(opt => opt.value === keyOperandType)?.symbol ?? '');

  const combinedLabel = keyOperandSymbol
    ? `${keyComparisonSymbol}${keyOperandSymbol}`
    : keyComparisonSymbol;

  const combinedTooltip =
    keyOperandType === 'none'
      ? t('Header key %s', keyComparisonLabel)
      : t('Header key %s matching a string %s', keyComparisonLabel, keyOperandLabel);

  return {combinedLabel, combinedTooltip};
}

export function getHeaderValueCombinedLabelAndTooltip(
  op: HeaderCheckOp,
  headerValueComparisonOptions: HeaderComparisonOption[]
): {combinedLabel: string; combinedTooltip: string} {
  const valueOperandType = op.value_operand.header_op;

  const valueComparisonLabel =
    headerValueComparisonOptions.find(opt => opt.value === op.value_op.cmp)?.label ?? '';
  const valueComparisonSymbol =
    headerValueComparisonOptions.find(opt => opt.value === op.value_op.cmp)?.symbol ?? '';

  const valueOperandLabel =
    valueOperandType === 'none'
      ? ''
      : (HEADER_OPERAND_OPTIONS.find(opt => opt.value === valueOperandType)?.label ?? '');
  const valueOperandSymbol =
    valueOperandType === 'none'
      ? ''
      : (HEADER_OPERAND_OPTIONS.find(opt => opt.value === valueOperandType)?.symbol ??
        '');

  const combinedLabel = valueOperandSymbol
    ? `${valueComparisonSymbol}${valueOperandSymbol}`
    : valueComparisonSymbol;

  const combinedTooltip =
    valueOperandType === 'none'
      ? t('Header value %s', valueComparisonLabel)
      : t('Header value %s to a string %s', valueComparisonLabel, valueOperandLabel);

  return {combinedLabel, combinedTooltip};
}
