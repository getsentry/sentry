import type {DiffItem, TreemapDiffElement} from 'sentry/views/preprod/types/appSizeTypes';

export function buildTreemapDiff(diffItems: DiffItem[]): TreemapDiffElement | null {
  if (diffItems.length === 0) {
    return null;
  }

  const root = buildTreeFromDiffItems(diffItems);

  if (!root || root.size_diff === 0) {
    return null;
  }

  return root;
}

export function buildTreeFromDiffItems(diffItems: DiffItem[]): TreemapDiffElement | null {
  if (diffItems.length === 0) {
    return null;
  }

  // Placeholder values, will be updated later as part of calculateAggregatedValues
  const root: TreemapDiffElement = {
    name: 'root',
    path: '',
    size_diff: 0,
    diff_type: 'increased',
    is_dir: true,
    children: [],
  };

  for (const diffItem of diffItems) {
    insertDiffItem(root, diffItem);
  }

  calculateAggregatedValues(root);

  return root;
}

function insertDiffItem(root: TreemapDiffElement, diffItem: DiffItem): void {
  const pathParts = diffItem.path.split('/').filter(part => part !== '');
  let currentNode = root;

  // Create the directory structure (if it doesn't exist)
  for (let i = 0; i < pathParts.length - 1; i++) {
    const dirName = pathParts[i];
    const dirPath = pathParts.slice(0, i + 1).join('/');

    if (!dirName) {
      continue;
    }

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
        size_diff: 0,
        diff_type: 'increased',
        is_dir: true,
        children: [],
      };
      currentNode.children.push(childDir);
    }
    currentNode = childDir;
  }

  const fileName = pathParts[pathParts.length - 1] || diffItem.path;

  if (!currentNode.children) {
    currentNode.children = [];
  }

  currentNode.children.push({
    name: fileName,
    path: diffItem.path,
    size_diff: diffItem.size_diff,
    diff_type: diffItem.type,
    is_dir: false,
    children: null,
  });
}

function calculateAggregatedValues(node: TreemapDiffElement): void {
  if (!node.children || node.children.length === 0) {
    return;
  }

  node.children.forEach(child => calculateAggregatedValues(child));

  let totalSizeDiff = 0;

  for (const child of node.children) {
    totalSizeDiff += child.size_diff;
  }

  // Update this directory's values only if it doesn't have its own direct diff
  if (node.size_diff === 0) {
    node.size_diff = totalSizeDiff;

    // Determine the diff type based on the aggregated size diff
    if (totalSizeDiff > 0) {
      node.diff_type = 'increased';
    } else if (totalSizeDiff < 0) {
      node.diff_type = 'decreased';
    }
  }
}
