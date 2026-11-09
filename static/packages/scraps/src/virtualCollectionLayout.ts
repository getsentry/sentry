import type {Key, Node} from '@react-types/shared';

import type {FormSize} from '@sentry/scraps/theme';

export const ROW_HEIGHT_ESTIMATES = {
  xs: {regular: 25, withDetails: 42},
  sm: {regular: 32, withDetails: 49},
  md: {regular: 36, withDetails: 53},
} as const satisfies Record<FormSize, {regular: number; withDetails: number}>;

/**
 * Index of the section row each node belongs to, if that section is in
 * `nodes`. Undefined for a node that is not in a section.
 */
export function getSectionIndexes<T>(
  nodes: ReadonlyArray<Node<T>>
): Array<number | undefined> {
  const indexByKey = new Map<Key, number>();
  nodes.forEach((node, index) => {
    if (node.type === 'section') {
      indexByKey.set(node.key, index);
    }
  });
  return nodes.map(node =>
    node.parentKey === null || node.parentKey === undefined
      ? undefined
      : indexByKey.get(node.parentKey)
  );
}

interface MountedIndexesOptions {
  /** Index of the focused row, or -1. */
  focusedIndex: number;
  /** Per node, the index of its section row. See `getSectionIndexes`. */
  sectionIndexes: ReadonlyArray<number | undefined>;
  /** Index of the row to keep mounted for the menu's width, or -1. */
  widestIndex: number;
  /** The rows in or near the viewport. */
  windowIndexes: readonly number[];
}

/**
 * The rows to mount: those in the window, plus the focused row so it keeps DOM
 * focus when scrolled out of view, the widest row so a list that sizes to its
 * content does not widen while scrolling, and the section row of every mounted
 * row, since the section's element wraps its children. Sorted by index.
 */
export function getMountedIndexes({
  windowIndexes,
  focusedIndex,
  widestIndex,
  sectionIndexes,
}: MountedIndexesOptions): number[] {
  const indexes = new Set(windowIndexes);
  for (const index of [focusedIndex, widestIndex]) {
    if (index !== -1) {
      indexes.add(index);
    }
  }
  for (const index of [...indexes]) {
    const sectionIndex = sectionIndexes[index];
    if (sectionIndex !== undefined) {
      indexes.add(sectionIndex);
    }
  }
  return [...indexes].sort((a, b) => a - b);
}

/**
 * Whether `node` is an item of `section` other than its first. These are the
 * items a menu spaces from the item above, see `spaceAbove` on `ListItem`.
 */
export function isAfterFirstInSection<T>(
  node: Node<T>,
  section: Node<T> | null | undefined
): boolean {
  if (!section || node.parentKey !== section.key) {
    return false;
  }
  const [first] = section.childNodes;
  return first !== undefined && first.key !== node.key;
}

/**
 * Height to assume for a row that has not been measured. A row after the
 * first in its section includes `sectionRowSpace`, which stands for padding on
 * the row's own element: mounted rows are measured by their border box, so
 * they include it too.
 */
export function estimateRowHeight<T>(
  node: Node<T> | undefined,
  section: Node<T> | undefined,
  size: FormSize,
  sectionRowSpace: number
): number {
  const heights = ROW_HEIGHT_ESTIMATES[size];
  // `Node.props` is typed `any`; the only prop read here is `details`.
  const props: {details?: unknown} | undefined = node?.props;
  const height = props?.details ? heights.withDetails : heights.regular;
  return node && isAfterFirstInSection(node, section) ? height + sectionRowSpace : height;
}
