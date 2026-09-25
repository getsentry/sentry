const MAX_TREE_DEPTH = 4;
const BRANCH_MATCHES_REGEX = /\./g;
const INVALID_BRANCH_REGEX = /\.{2,}/;

export type KeyValueTreeValue = number | string | null;

export interface KeyValueTreeRowConfig {
  /** Omits the dropdown of actions applicable to this row. */
  disableActions?: boolean;
  /** Omits error styling, even when the value's metadata reports errors. */
  disableErrors?: boolean;
  /** Renders the value as plain text rather than a hyperlink where applicable. */
  disableRichValue?: boolean;
}

type KeyValueTree<Value extends KeyValueTreeValue, Original> = Map<
  string,
  KeyValueTreeContent<Value, Original>
>;

export interface KeyValueTreeContent<Value extends KeyValueTreeValue, Original> {
  subtree: KeyValueTree<Value, Original>;
  /** Trunk rows only exist to nest their branches under, so they have no value. */
  value: Value | '';
  meta?: Record<string, any>;
  original?: Original;
}

interface KeyValueTreeItem<Value extends KeyValueTreeValue, Original> {
  key: string;
  original: Original;
  value: Value;
  meta?: Record<string, any>;
}

interface KeyValueTreeRowDescriptor<Value extends KeyValueTreeValue, Original> {
  content: KeyValueTreeContent<Value, Original>;
  /** Whether to draw the vertical line connecting this row's branch icon to the next. */
  hasStem: boolean;
  spacerCount: number;
  treeKey: string;
  uniqueKey: string;
}

function addToKeyValueTree<Value extends KeyValueTreeValue, Original>(
  tree: KeyValueTree<Value, Original>,
  key: string,
  item: KeyValueTreeItem<Value, Original>
): KeyValueTree<Value, Original> {
  if (!key) {
    return tree;
  }

  const branchMatches = key.match(BRANCH_MATCHES_REGEX) ?? [];
  const hasInvalidBranchCount =
    branchMatches.length <= 0 || branchMatches.length > MAX_TREE_DEPTH;
  const hasInvalidBranchSequence = INVALID_BRANCH_REGEX.test(key);

  // Keys with 0, or >4 branches, as well as sequential dots (e.g. 'some..key'), stay flat
  if (hasInvalidBranchCount || hasInvalidBranchSequence) {
    tree.set(key, {
      value: item.value,
      subtree: tree.get(key)?.subtree ?? new Map(),
      meta: item.meta,
      original: item.original,
    });
    return tree;
  }

  // E.g. 'device.model.version'
  const splitIndex = key.indexOf('.'); // 6
  const trunk = key.slice(0, splitIndex); // 'device'
  const branch = key.slice(splitIndex + 1); // 'model.version'

  let trunkNode = tree.get(trunk);
  if (!trunkNode) {
    trunkNode = {value: '', subtree: new Map()};
    tree.set(trunk, trunkNode);
  }
  trunkNode.subtree = addToKeyValueTree(trunkNode.subtree, branch, item);
  return tree;
}

/**
 * Nests dot delimited keys (e.g. `device.model.version`) under shared trunks.
 */
export function buildKeyValueTree<Value extends KeyValueTreeValue, Original>(
  items: Array<KeyValueTreeItem<Value, Original>>
): KeyValueTree<Value, Original> {
  return items.reduce<KeyValueTree<Value, Original>>(
    (tree, item) => addToKeyValueTree(tree, item.key, item),
    new Map()
  );
}

function flattenKeyValueTreeRows<Value extends KeyValueTreeValue, Original>(
  descriptor: KeyValueTreeRowDescriptor<Value, Original>
): Array<KeyValueTreeRowDescriptor<Value, Original>> {
  const branches = Array.from(descriptor.content.subtree.entries());
  return [
    descriptor,
    ...branches.flatMap(([treeKey, content], index) =>
      flattenKeyValueTreeRows({
        content,
        treeKey,
        spacerCount: descriptor.spacerCount + 1,
        hasStem: index < branches.length - 1 && content.subtree.size === 0,
        uniqueKey: `${descriptor.uniqueKey}-${index}`,
      })
    ),
  ];
}

/**
 * Splits groups of rows into roughly even columns without separating any group,
 * so a root row always stays in the same column as its branches.
 */
function distributeRowGroupsIntoColumns<Row>(
  rowGroups: Row[][],
  columnCount: number
): Row[][][] {
  const rowTotal = rowGroups.reduce((sum, rowGroup) => sum + rowGroup.length, 0);
  const columnRowGoal = Math.ceil(rowTotal / columnCount);

  const columns: Row[][][] = [];
  let startIndex = 0;
  let runningTotal = 0;

  rowGroups.forEach((rowGroup, index) => {
    if (index === rowGroups.length - 1) {
      columns.push(rowGroups.slice(startIndex));
      return;
    }
    if (runningTotal >= columnRowGoal) {
      columns.push(rowGroups.slice(startIndex, index));
      runningTotal = 0;
      startIndex = index;
    }
    runningTotal += rowGroup.length;
  });

  return columns;
}

export function getKeyValueTreeColumns<Value extends KeyValueTreeValue, Original>(
  tree: KeyValueTree<Value, Original>,
  columnCount: number
): Array<Array<KeyValueTreeRowDescriptor<Value, Original>>> {
  const rowGroups = Array.from(tree.entries()).map(([treeKey, content], index) =>
    flattenKeyValueTreeRows({
      content,
      treeKey,
      spacerCount: 0,
      hasStem: content.subtree.size === 0,
      uniqueKey: `${index}`,
    })
  );

  return distributeRowGroupsIntoColumns(rowGroups, columnCount).map(column =>
    column.flat()
  );
}
