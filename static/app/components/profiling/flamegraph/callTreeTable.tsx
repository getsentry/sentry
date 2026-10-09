import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {IconSettings} from '@sentry/icons/settings';
import {IconUser} from '@sentry/icons/user';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  useVirtualizedTree,
  type UseVirtualizedTreeProps,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import type {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import type {VirtualizedTreeRenderedRow} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';

const ROW_HEIGHT = 24;
const WEIGHT_COLUMN_WIDTH = 160;
const INDENT_WIDTH = 14;

const COLUMNS: TableColumnConfig[] = [
  {key: 'weight', width: WEIGHT_COLUMN_WIDTH},
  {key: 'secondaryWeight', width: WEIGHT_COLUMN_WIDTH},
  {key: 'frame', width: 'minmax(max-content, 1fr)'},
];

function scrollRowIntoView(table: HTMLTableElement, rowIndex: number) {
  // The sticky header covers the top of the scroll area, so rows are measured
  // against the height below it.
  const visibleHeight = table.clientHeight - (table.tHead?.offsetHeight ?? 0);
  const rowTop = rowIndex * ROW_HEIGHT;

  if (rowTop < table.scrollTop) {
    table.scrollTop = rowTop;
  } else if (rowTop + ROW_HEIGHT > table.scrollTop + visibleHeight) {
    table.scrollTop = rowTop + ROW_HEIGHT - visibleHeight;
  }
}

function scrollCallTreeTableToNode(
  table: HTMLTableElement | null,
  node: VirtualizedTreeRenderedRow<FlamegraphFrame> | undefined,
  coordinates?: {depth: number; top: number}
) {
  if (!table) {
    return;
  }

  if (node) {
    scrollRowIntoView(table, node.key);
  }

  const depth = coordinates?.depth ?? node?.item.depth;
  if (depth !== undefined) {
    table.scrollLeft = depth * INDENT_WIDTH;
  }
}

type UseCallTreeTableProps = Omit<
  UseVirtualizedTreeProps<FlamegraphFrame>,
  'onScrollToNode' | 'rowHeight' | 'scrollContainer'
>;

export function useCallTreeTable(props: UseCallTreeTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLTableElement | null>(null);

  useLayoutEffect(() => {
    setScrollContainer(tableRef.current);
  }, []);

  const onScrollToNode = useCallback(
    (
      node: VirtualizedTreeRenderedRow<FlamegraphFrame> | undefined,
      _scrollContainer: HTMLElement | HTMLElement[] | null,
      coordinates?: {depth: number; top: number}
    ) => {
      scrollCallTreeTableToNode(tableRef.current, node, coordinates);
    },
    []
  );

  const virtualizedTree = useVirtualizedTree<FlamegraphFrame>({
    ...props,
    onScrollToNode,
    rowHeight: ROW_HEIGHT,
    scrollContainer,
  });

  const {dispatch, handleRowKeyDown, items, selectedNodeIndex} = virtualizedTree;

  // Rows use a roving tabindex. Without a rendered selected row, the first rendered
  // row takes the tab stop so keyboard users can still reach the tree.
  const tabbableIndex = items.some(item => item.key === selectedNodeIndex)
    ? selectedNodeIndex
    : items[0]?.key;

  const getRowProps = (row: VirtualizedTreeRenderedRow<FlamegraphFrame>) => ({
    isSelected: row.key === selectedNodeIndex,
    node: row.item,
    onFocus: (event: React.FocusEvent<HTMLTableRowElement>) => {
      if (event.target === event.currentTarget && row.key !== selectedNodeIndex) {
        dispatch({type: 'set selected node index', payload: row.key});
        if (tableRef.current) {
          scrollRowIntoView(tableRef.current, row.key);
        }
      }
    },
    onKeyDown: handleRowKeyDown,
    ref: (element: HTMLTableRowElement | null) => {
      row.ref = element;
    },
    tabIndex: row.key === tabbableIndex ? 0 : -1,
  });

  return {
    ...virtualizedTree,
    getRowProps,
    rowCount: virtualizedTree.tree.flattened.length,
    tableRef,
  };
}

interface CallTreeTableProps {
  children: ReactNode;
  header: ReactNode;
  items: Array<VirtualizedTreeRenderedRow<FlamegraphFrame>>;
  ref: RefObject<HTMLTableElement | null>;
  rowCount: number;
}

export function CallTreeTable({
  children,
  header,
  items,
  ref,
  rowCount,
}: CallTreeTableProps) {
  const firstRenderedIndex = items[0]?.key ?? 0;
  const lastRenderedIndex = items[items.length - 1]?.key ?? -1;

  return (
    <StickyWeightsTable
      aria-label={t('Call tree')}
      columns={COLUMNS}
      customSections
      density="compressed"
      maxHeight="100%"
      ref={ref}
      role="treegrid"
      scrollable
    >
      <SimpleTable.Head sticky>
        <SimpleTable.HeaderRow>{header}</SimpleTable.HeaderRow>
      </SimpleTable.Head>
      <SimpleTable.Body
        style={{
          paddingTop: firstRenderedIndex * ROW_HEIGHT,
          paddingBottom: (rowCount - lastRenderedIndex - 1) * ROW_HEIGHT,
        }}
      >
        {children}
      </SimpleTable.Body>
    </StickyWeightsTable>
  );
}

interface CallTreeTableRowProps {
  children: ReactNode;
  isSelected: boolean;
  node: VirtualizedTreeNode<FlamegraphFrame>;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onFocus: (event: React.FocusEvent<HTMLTableRowElement>) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  ref: (element: HTMLTableRowElement | null) => void;
  tabIndex: number;
}

export function CallTreeTableRow({
  children,
  isSelected,
  node,
  ...props
}: CallTreeTableRowProps) {
  return (
    <TreeRow
      {...props}
      aria-expanded={node.node.children.length > 0 ? node.expanded : undefined}
      aria-level={node.depth + 1}
      aria-selected={isSelected}
    >
      {children}
    </TreeRow>
  );
}

interface CallTreeTableWeightCellProps {
  children: ReactNode;
  isApplicationFrame?: boolean;
  relativeWeight?: number;
}

export function CallTreeTableWeightCell({
  children,
  isApplicationFrame,
  relativeWeight,
}: CallTreeTableWeightCellProps) {
  return (
    <SimpleTable.RowCell justify="end" gap="sm" role="gridcell">
      {relativeWeight === undefined ? null : (
        <WeightBar style={{transform: `scaleX(${relativeWeight / 100})`}} />
      )}
      <Text tabular wrap="nowrap">
        {children}
      </Text>
      {relativeWeight === undefined ? null : (
        <Container minWidth="7ch">
          <Text as="div" align="right" tabular variant="muted">
            {relativeWeight.toFixed(1)}%
          </Text>
        </Container>
      )}
      {isApplicationFrame === undefined ? null : isApplicationFrame ? (
        <IconUser size="xs" variant="muted" />
      ) : (
        <IconSettings size="xs" variant="muted" />
      )}
    </SimpleTable.RowCell>
  );
}

interface CallTreeTableFrameCellProps {
  frameColor: string;
  node: VirtualizedTreeNode<FlamegraphFrame>;
  onExpandClick: (
    node: VirtualizedTreeNode<FlamegraphFrame>,
    expand: boolean,
    opts?: {expandChildren: boolean}
  ) => void;
}

export function CallTreeTableFrameCell({
  frameColor,
  node,
  onExpandClick,
}: CallTreeTableFrameCellProps) {
  const theme = useTheme();

  const handleExpandClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onExpandClick(node, !node.expanded, {expandChildren: event.metaKey});
  };

  return (
    // The expand toggle is as tall as the row, so this cell can't take the
    // table's vertical padding without spilling into the neighboring rows.
    <SimpleTable.RowCell
      gap="xs"
      padding="0 md"
      role="gridcell"
      style={{paddingLeft: `calc(${theme.space.md} + ${node.depth * INDENT_WIDTH}px)`}}
    >
      <Container
        flexShrink={0}
        height="12px"
        radius="2xs"
        width="12px"
        style={{backgroundColor: frameColor}}
      />
      {node.node.children.length > 0 ? (
        <Button
          aria-expanded={node.expanded}
          aria-label={node.expanded ? t('Collapse') : t('Expand')}
          icon={<IconChevron direction={node.expanded ? 'down' : 'right'} size="xs" />}
          onClick={handleExpandClick}
          onMouseDown={event => event.preventDefault()}
          size="zero"
          tabIndex={-1}
          variant="transparent"
        />
      ) : (
        <Container flexShrink={0} width="24px" />
      )}
      <Text wrap="nowrap">{node.node.frame.name}</Text>
    </SimpleTable.RowCell>
  );
}

export function makeCallTreeTableSortFunction(
  property: 'sample count' | 'duration' | 'total weight' | 'self weight' | 'name',
  direction: 'asc' | 'desc'
) {
  if (property === 'duration') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.node.aggregate_duration_ns - a.node.node.aggregate_duration_ns;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.node.aggregate_duration_ns - b.node.node.aggregate_duration_ns;
        };
  }

  // Sample counts are stored as weights
  if (property === 'total weight' || property === 'sample count') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.node.totalWeight - a.node.node.totalWeight;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.node.totalWeight - b.node.node.totalWeight;
        };
  }

  if (property === 'self weight') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.node.selfWeight - a.node.node.selfWeight;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.node.selfWeight - b.node.node.selfWeight;
        };
  }

  if (property === 'name') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.frame.name.localeCompare(b.node.frame.name);
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.frame.name.localeCompare(a.node.frame.name);
        };
  }

  throw new Error(`Unknown sort property ${property}`);
}

// Sizing the container by its own layout instead of the table's rows keeps the
// table scrolling inside it, which is what keeps the rows virtualized.
export const CallTreeTableContainer = styled('div')`
  contain: size;
  position: relative;
  flex: 1 1 100%;
  width: 100%;
`;

// The weight columns stay pinned while deep frames scroll horizontally.
const StickyWeightsTable = styled(SimpleTable)`
  tr > :nth-child(-n + 2) {
    position: sticky;
    z-index: 1;
    align-self: stretch;
    background: inherit;
  }

  tr > :first-child {
    left: 0;
  }

  tr > :nth-child(2) {
    left: ${WEIGHT_COLUMN_WIDTH}px;
  }
`;

const TreeRow = styled(SimpleTable.Row)`
  height: ${ROW_HEIGHT}px;
  background: ${p => p.theme.tokens.background.primary};

  &[aria-selected='true'] {
    background: ${p => p.theme.tokens.background.accent.vibrant};
    color: ${p => p.theme.tokens.content.onVibrant.light};

    * {
      color: inherit;
    }
  }
`;

const WeightBar = styled('div')`
  position: absolute;
  inset: 0;
  background-color: ${p => p.theme.colors.yellow100};
  transform-origin: center right;
  pointer-events: none;
`;
