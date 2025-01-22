import type {EntryException, ExceptionValue} from 'sentry/types/event';
import {defined} from 'sentry/utils';

type ExceptionGroupTreeItem = {
  children: ExceptionGroupTreeItem[];
  value: ExceptionValue;
};

function buildExceptionGroupTreeRecursive(
  values: ExceptionValue[],
  parentId: number | undefined,
  visited: Set<number> = new Set<number>()
): ExceptionGroupTreeItem[] {
  const tree: ExceptionGroupTreeItem[] = [];

  values.forEach(value => {
    if (
      value.mechanism?.parent_id === parentId &&
      defined(value.mechanism?.exception_id) &&
      !visited.has(value.mechanism.exception_id)
    ) {
      visited.add(value.mechanism.exception_id);
      tree.push({
        children: buildExceptionGroupTreeRecursive(
          values,
          value.mechanism.exception_id,
          visited
        ),
        value,
      });
    }
  });

  return tree;
}

export function buildExceptionGroupTree(entry: EntryException) {
  const values = entry.data.values || [];

  return buildExceptionGroupTreeRecursive(values, undefined);
}

function getTreeHeightRecursive(tree: ExceptionGroupTreeItem[], maxHeight: number = 0) {
  if (!tree.length) {
    return maxHeight;
  }

  let maxLevelHeight = maxHeight;

  for (const node of tree) {
    const height = 1 + getTreeHeightRecursive(node.children, maxHeight);
    maxLevelHeight = Math.max(maxLevelHeight, height);
  }

  return Math.max(maxHeight, maxLevelHeight);
}

function getTreeWidthRecursive(
  tree: ExceptionGroupTreeItem[],
  depth: number = 0,
  widthByDepth: number[] = []
) {
  if (!tree.length) {
    return 0;
  }

  widthByDepth[depth] = widthByDepth[depth] || 0;

  for (const node of tree) {
    widthByDepth[depth] += 1;
    getTreeWidthRecursive(node.children, depth + 1, widthByDepth);
  }

  return Math.max(...widthByDepth);
}

export function getExceptionGroupHeight(entry: EntryException) {
  const tree = buildExceptionGroupTree(entry);

  return getTreeHeightRecursive(tree);
}

export function getExceptionGroupWidth(entry: EntryException) {
  const tree = buildExceptionGroupTree(entry);

  return getTreeWidthRecursive(tree);
}
