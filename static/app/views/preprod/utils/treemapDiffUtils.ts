import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import type {DiffItem, TreemapDiffElement} from 'sentry/views/preprod/types/appSizeTypes';

export function formatSizeDiff(sizeDiff: number): string {
  const sign = sizeDiff > 0 ? '+' : '';
  return sign + formatBytesBase10(sizeDiff);
}

export function buildTreemapDiff(diffItems: DiffItem[]): TreemapDiffElement | null {
  if (diffItems.length === 0) {
    return null;
  }

  // Build the tree structure from diff items
  const root = buildTreeFromDiffItems(diffItems);

  // Only return if there are changes
  if (!root || !hasChanges(root)) {
    return null;
  }

  return root;
}

export function buildTreeFromDiffItems(diffItems: DiffItem[]): TreemapDiffElement | null {
  if (diffItems.length === 0) {
    return null;
  }

  // Create the root node
  const root: TreemapDiffElement = {
    name: 'root',
    path: '',
    size: 0,
    size_diff: 0,
    diff_type: 'increased',
    is_dir: true,
    type: 'files',
    children: [],
  };

  // Insert each diff item into the tree
  for (const diffItem of diffItems) {
    insertDiffItem(root, diffItem);
  }

  // Calculate aggregated values for all directories
  calculateAggregatedValues(root);

  return root;
}

function insertDiffItem(root: TreemapDiffElement, diffItem: DiffItem): void {
  const pathParts = diffItem.path.split('/').filter(part => part !== '');
  let currentNode = root;

  // Navigate/create the directory structure
  for (let i = 0; i < pathParts.length - 1; i++) {
    const dirName = pathParts[i];
    const dirPath = pathParts.slice(0, i + 1).join('/');

    if (!currentNode.children) {
      currentNode.children = [];
    }

    let childDir = currentNode.children.find(
      child => child.name === dirName && child.is_dir
    );
    if (!childDir) {
      childDir = {
        name: dirName,
        path: dirPath,
        size: 0,
        size_diff: 0,
        diff_type: 'increased',
        is_dir: true,
        type: 'files',
        children: [],
      };
      currentNode.children.push(childDir);
    }
    currentNode = childDir;
  }

  // Create the file node
  const fileName = pathParts[pathParts.length - 1] || diffItem.path;
  const fileSize = getFileSize(diffItem);

  if (!currentNode.children) {
    currentNode.children = [];
  }

  currentNode.children.push({
    name: fileName,
    path: diffItem.path,
    size: fileSize,
    size_diff: diffItem.size_diff,
    diff_type: diffItem.type,
    is_dir: false,
    type: diffItem.item_type || 'files',
    children: null,
  });
}

export function getFileSize(diffItem: DiffItem): number {
  // For added files, use head_size (current size)
  if (
    diffItem.type === 'added' &&
    diffItem.head_size !== null &&
    diffItem.head_size !== undefined
  ) {
    return diffItem.head_size;
  }

  // For removed files, use base_size (original size)
  if (
    diffItem.type === 'removed' &&
    diffItem.base_size !== null &&
    diffItem.base_size !== undefined
  ) {
    return diffItem.base_size;
  }

  // For modified files, use head_size (current size)
  if (
    (diffItem.type === 'increased' || diffItem.type === 'decreased') &&
    diffItem.head_size !== null &&
    diffItem.head_size !== undefined
  ) {
    return diffItem.head_size;
  }

  // Fallback: calculate from size_diff and base_size
  if (diffItem.base_size !== null && diffItem.base_size !== undefined) {
    return diffItem.base_size + diffItem.size_diff;
  }

  // Last resort: use absolute value of size_diff
  return Math.abs(diffItem.size_diff);
}

function calculateAggregatedValues(node: TreemapDiffElement): void {
  if (!node.children || node.children.length === 0) {
    return;
  }

  // First, calculate values for all children recursively
  node.children.forEach(child => calculateAggregatedValues(child));

  // Then calculate this node's aggregated values
  let totalSize = 0;
  let totalSizeDiff = 0;

  for (const child of node.children) {
    totalSize += child.size;
    totalSizeDiff += child.size_diff;
  }

  // Update this directory's values only if it doesn't have its own direct diff
  if (node.size === 0 && node.size_diff === 0) {
    node.size = totalSize;
    node.size_diff = totalSizeDiff;

    // Determine the diff type based on the aggregated size diff
    if (totalSizeDiff > 0) {
      node.diff_type = 'increased';
    } else if (totalSizeDiff < 0) {
      node.diff_type = 'decreased';
    }
  }
}

function hasChanges(element: TreemapDiffElement): boolean {
  if (element.size_diff !== 0) {
    return true;
  }

  if (element.children) {
    return element.children.some(child => hasChanges(child));
  }

  return false;
}
