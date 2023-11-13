import {forwardRef, Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import PerformanceDuration from 'sentry/components/performanceDuration';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow, IconSettings, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {formatColorForFrame} from 'sentry/utils/profiling/gl/utils';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {
  useVirtualizedTree,
  UseVirtualizedTreeProps,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {VirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import {VirtualizedTreeRenderedRow} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useFlamegraph} from 'sentry/views/profiling/flamegraphProvider';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {AggregateFlamegraphTreeContextMenu} from './aggregateFlamegraphTreeContextMenu';

function computeRelativeWeight(base: number, value: number) {
  // Make sure we dont divide by zero
  if (!base || !value) {
    return 0;
  }
  return (value / base) * 100;
}

const enum FastFrameCallersTableClassNames {
  ROW = 'FrameCallersRow',
  CELL = 'FrameCallersTableCell',
  FRAME_CELL = 'FrameCallersTableCellFrame',
  WEIGHT = 'FrameCallersTableCellWeight',
  BACKGROUND_WEIGHT = 'FrameCallersTableCellWeightBar',
  FRAME_TYPE = 'FrameCallersTableCellFrameType',
  COLOR_INDICATOR = 'FrameCallersTableCellColorIndicator',
  EXPAND_BUTTON = 'FrameCallersTableCellExpandButton',
  GHOST_ROW_CELL = 'FrameCallersTableCellGhostRow',
  GHOST_ROW_CONTAINER = 'FrameCallersTableCellGhostRowContainer',
}

interface FastFrameCallersRowsProps {
  formatDuration: (value: number) => string;
  frameColor: string;
  node: VirtualizedTreeNode<FlamegraphFrame>;
  onExpandClick: (
    node: VirtualizedTreeNode<FlamegraphFrame>,
    expand: boolean,
    opts?: {expandChildren: boolean}
  ) => void;
  referenceNode: FlamegraphFrame;
  tabIndex: number;
}

interface FastFrameCallerRowProps {
  children: React.ReactNode;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onMouseEnter: () => void;
  tabIndex: number;
  top: string;
}
const FastFrameCallersRow = forwardRef<HTMLDivElement, FastFrameCallerRowProps>(
  (props, ref) => {
    return (
      <div
        ref={ref}
        className={FastFrameCallersTableClassNames.ROW}
        style={{top: props.top}}
        tabIndex={props.tabIndex}
        onClick={props.onClick}
        onKeyDown={props.onKeyDown}
        onMouseEnter={props.onMouseEnter}
        onContextMenu={props.onContextMenu}
      >
        {props.children}
      </div>
    );
  }
);

const TEXT_ALIGN_RIGHT: React.CSSProperties = {textAlign: 'right'};
function FastFrameCallersFixedRows(props: FastFrameCallersRowsProps) {
  const totalWeight = computeRelativeWeight(
    props.referenceNode.node.totalWeight,
    props.node.node.node.totalWeight
  );

  const totalAggregateDuration = computeRelativeWeight(
    props.referenceNode.node.aggregate_duration_ns,
    props.node.node.node.aggregate_duration_ns
  );

  return (
    <Fragment>
      <div className={FastFrameCallersTableClassNames.CELL} style={TEXT_ALIGN_RIGHT}>
        {props.node.node.node.totalWeight}
        <div className={FastFrameCallersTableClassNames.WEIGHT}>
          {totalWeight.toFixed(2)}%
          <div
            className={FastFrameCallersTableClassNames.BACKGROUND_WEIGHT}
            style={{transform: `scaleX(${totalWeight / 100})`}}
          />
        </div>
      </div>
      <div className={FastFrameCallersTableClassNames.CELL} style={TEXT_ALIGN_RIGHT}>
        <PerformanceDuration
          nanoseconds={props.node.node.node.aggregate_duration_ns}
          abbreviation
        />
        <div className={FastFrameCallersTableClassNames.WEIGHT}>
          {totalAggregateDuration.toFixed(2)}%
          <div
            className={FastFrameCallersTableClassNames.BACKGROUND_WEIGHT}
            style={{transform: `scaleX(${totalAggregateDuration / 100})`}}
          />
        </div>
        <div className={FastFrameCallersTableClassNames.FRAME_TYPE}>
          {props.node.node.node.frame.is_application ? (
            <IconUser size="xs" />
          ) : (
            <IconSettings size="xs" />
          )}
        </div>
      </div>
    </Fragment>
  );
}

function FastFrameCallersDynamicRows(props: FastFrameCallersRowsProps) {
  const handleExpanding = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    props.onExpandClick(props.node, !props.node.expanded, {
      expandChildren: evt.metaKey,
    });
  };

  return (
    <div
      className={FastFrameCallersTableClassNames.FRAME_CELL}
      style={{paddingLeft: props.node.depth * 14 + 8, width: '100%'}}
    >
      <div
        className={FastFrameCallersTableClassNames.COLOR_INDICATOR}
        style={{backgroundColor: props.frameColor}}
      />
      <button
        className={FastFrameCallersTableClassNames.EXPAND_BUTTON}
        style={props.node.expanded ? {transform: 'rotate(90deg)'} : {}}
        onClick={handleExpanding}
      >
        {props.node.node.children.length > 0 ? '\u203A' : null}
      </button>
      <div>
        <div>{props.node.node.frame.name}</div>
      </div>
    </div>
  );
}

const FrameCallersTable = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin: 0;
  overflow: auto;
  max-height: 100%;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.background};

  .${FastFrameCallersTableClassNames.ROW} {
    display: flex;
    line-height: 24px;
    font-size: 12px;
    position: absolute;
    width: 100%;

    &:focus {
      outline: none;
    }

    &[tabindex='0'] {
      background: ${p => p.theme.blue300};
      color: #fff;

      .${FastFrameCallersTableClassNames.WEIGHT} {
        color: ${p => p.theme.white};
        opacity: 0.7;
      }

      .${FastFrameCallersTableClassNames.BACKGROUND_WEIGHT} {
        background-color: ${props => props.theme.yellow100};
        border-bottom: 1px solid ${props => props.theme.yellow200};
      }

      .${FastFrameCallersTableClassNames.FRAME_TYPE} {
        color: ${p => p.theme.white};
        opacity: 0.7;
      }
    }

    &[data-hovered='true']:not([tabindex='0']) {
      background: ${p => p.theme.surface200};
    }
  }

  .${FastFrameCallersTableClassNames.CELL} {
    position: relative;
    width: 164px;
    border-right: 1px solid ${p => p.theme.border};
    display: flex;
    align-items: center;
    padding-right: ${space(1)};
    justify-content: flex-end;

    &:nth-child(2) {
      padding-right: 0;
    }

    &:focus {
      outline: none;
    }
  }

  .${FastFrameCallersTableClassNames.FRAME_CELL} {
    display: flex;
    align-items: center;
    padding: 0 ${space(1)};

    &:focus {
      outline: none;
    }
  }
  .${FastFrameCallersTableClassNames.WEIGHT} {
    display: inline-block;
    min-width: 7ch;
    padding-right: 0px;
    color: ${p => p.theme.subText};
    opacity: 1;
  }
  .${FastFrameCallersTableClassNames.BACKGROUND_WEIGHT} {
    pointer-events: none;
    position: absolute;
    right: 0;
    top: 0;
    background-color: ${props => props.theme.yellow100};
    border-bottom: 1px solid ${props => props.theme.yellow200};
    transform-origin: center right;
    height: 100%;
    width: 100%;
  }

  .${FastFrameCallersTableClassNames.FRAME_TYPE} {
    flex-shrink: 0;
    width: 26px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${p => p.theme.subText};
    opacity: ${_p => 1};
  }

  .${FastFrameCallersTableClassNames.COLOR_INDICATOR} {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    display: inline-block;
    flex-shrink: 0;
    margin-right: ${space(0.5)};
  }

  .${FastFrameCallersTableClassNames.EXPAND_BUTTON} {
    width: 10px;
    height: 10px;
    display: flex;
    flex-shrink: 0;
    padding: 0;
    border: none;
    background-color: transparent;
    align-items: center;
    justify-content: center;
    user-select: none;
    transform: rotate(0deg);
    margin-right: ${space(0.25)};
  }

  .${FastFrameCallersTableClassNames.GHOST_ROW_CELL} {
    width: 164px;
    height: 100%;
    border-right: 1px solid ${p => p.theme.border};
    position: absolute;
    left: 0;
    top: 0;

    &:nth-child(2) {
      left: 164px;
    }
  }

  .${FastFrameCallersTableClassNames.GHOST_ROW_CONTAINER} {
    display: flex;
    width: 100%;
    pointer-events: none;
    position: absolute;
    height: 100%;
  }
`;

function makeSortFunction(
  property: 'sample count' | 'duration' | 'name',
  direction: 'asc' | 'desc'
) {
  if (property === 'sample count') {
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

function skipRecursiveNodes(n: VirtualizedTreeNode<FlamegraphFrame>): boolean {
  return n.node.node.isDirectRecursive();
}

interface AggregateFlamegraphTreeTableProps {
  canvasPoolManager: CanvasPoolManager;
  canvasScheduler: CanvasScheduler;
  frameFilter: 'system' | 'application' | 'all';
  recursion: 'collapsed' | null;
  expanded?: boolean;
}

export function AggregateFlamegraphTreeTable({
  expanded,
  canvasScheduler,
  recursion,
  frameFilter,
}: AggregateFlamegraphTreeTableProps) {
  const dispatch = useDispatchFlamegraphState();
  const profiles = useFlamegraphProfiles();
  const profileGroup = useProfileGroup();
  const flamegraph = useFlamegraph();
  const theme = useFlamegraphTheme();
  const referenceNode = flamegraph.root;

  const [treeView, setTreeView] = useLocalStorageState<'bottom up' | 'top down'>(
    'profiling-aggregate-call-tree-view',
    'bottom up'
  );

  const rootNodes = useMemo(() => {
    return flamegraph.root.children;
  }, [flamegraph.root.children]);

  const tree: FlamegraphFrame[] | null = useMemo(() => {
    function skipFunction(frame: FlamegraphFrame): boolean {
      return frameFilter === 'application'
        ? !frame.frame.is_application
        : frameFilter === 'system'
        ? frame.frame.is_application
        : false;
    }

    const maybeFilteredRoots =
      frameFilter === 'all' ? rootNodes : filterFlamegraphTree(rootNodes, skipFunction);

    if (treeView === 'top down') {
      return maybeFilteredRoots;
    }
    return invertCallTree(maybeFilteredRoots);
  }, [frameFilter, rootNodes, treeView]);

  const {colorMap} = useMemo(() => {
    return theme.COLORS.STACK_TO_COLOR(
      flamegraph.frames,
      theme.COLORS.COLOR_MAPS['by symbol name'],
      theme.COLORS.COLOR_BUCKET,
      theme
    );
  }, [theme, flamegraph.frames]);

  const getFrameColor = useCallback(
    (frame: FlamegraphFrame) => {
      return formatColorForFrame(
        frame,
        colorMap.get(frame.key) ?? theme.COLORS.FRAME_GRAYSCALE_COLOR
      );
    },
    [theme, colorMap]
  );

  useEffect(() => {
    if (defined(profiles.threadId)) {
      return;
    }
    const threadID =
      typeof profileGroup.activeProfileIndex === 'number'
        ? profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId
        : null;
    // fall back case, when we finally load the active profile index from the profile,
    // make sure we update the thread id so that it is show first
    if (defined(threadID)) {
      dispatch({
        type: 'set thread id',
        payload: threadID,
      });
    }
  }, [profileGroup, profiles.threadId, dispatch]);

  const [scrollContainerRef, setFixedScrollContainerRef] =
    useState<HTMLDivElement | null>(null);
  const [dynamicScrollContainerRef, setDynamicScrollContainerRef] =
    useState<HTMLDivElement | null>(null);
  const [sort, setSort] = useState<'sample count' | 'duration' | 'name'>('sample count');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sortFunction = useMemo(() => {
    return makeSortFunction(sort, direction);
  }, [sort, direction]);

  const [tableParentContainer, setTableParentContainer] = useState<HTMLDivElement | null>(
    null
  );
  const contextMenu = useContextMenu({container: tableParentContainer});

  const fixedRenderRow: UseVirtualizedTreeProps<FlamegraphFrame>['renderRow'] =
    useCallback(
      (
        r,
        {
          handleRowClick,
          handleRowMouseEnter,
          handleExpandTreeNode,
          handleRowKeyDown,
          selectedNodeIndex,
        }
      ) => {
        return (
          <FastFrameCallersRow
            key={r.key}
            ref={n => {
              r.ref = n;
            }}
            top={r.styles.top}
            tabIndex={selectedNodeIndex === r.key ? 0 : 1}
            onKeyDown={handleRowKeyDown}
            onClick={handleRowClick}
            onMouseEnter={handleRowMouseEnter}
            onContextMenu={contextMenu.handleContextMenu}
          >
            <FastFrameCallersFixedRows
              node={r.item}
              referenceNode={referenceNode}
              frameColor={getFrameColor(r.item.node)}
              formatDuration={flamegraph.formatter}
              tabIndex={selectedNodeIndex === r.key ? 0 : 1}
              onExpandClick={handleExpandTreeNode}
            />
          </FastFrameCallersRow>
        );
      },
      [referenceNode, flamegraph.formatter, getFrameColor, contextMenu]
    );

  const dynamicRenderRow: UseVirtualizedTreeProps<FlamegraphFrame>['renderRow'] =
    useCallback(
      (
        r,
        {
          handleRowClick,
          handleRowMouseEnter,
          handleExpandTreeNode,
          handleRowKeyDown,
          selectedNodeIndex,
        }
      ) => {
        return (
          <FastFrameCallersRow
            key={r.key}
            ref={n => {
              r.ref = n;
            }}
            top={r.styles.top}
            tabIndex={selectedNodeIndex === r.key ? 0 : 1}
            onKeyDown={handleRowKeyDown}
            onClick={handleRowClick}
            onMouseEnter={handleRowMouseEnter}
            onContextMenu={contextMenu.handleContextMenu}
          >
            <FastFrameCallersDynamicRows
              node={r.item}
              referenceNode={referenceNode}
              frameColor={getFrameColor(r.item.node)}
              formatDuration={flamegraph.formatter}
              tabIndex={selectedNodeIndex === r.key ? 0 : 1}
              onExpandClick={handleExpandTreeNode}
            />
          </FastFrameCallersRow>
        );
      },
      [referenceNode, flamegraph.formatter, getFrameColor, contextMenu]
    );

  // This is slighlty unfortunate and ugly, but because our two columns are sticky
  // we need to scroll the container to the left when we scroll to a node. This
  // should be resolved when we split the virtualization between containers and sync scroll,
  // but is a larger undertaking and will take a bit longer
  const onScrollToNode: UseVirtualizedTreeProps<FlamegraphFrame>['onScrollToNode'] =
    useCallback(
      (
        node: VirtualizedTreeRenderedRow<FlamegraphFrame> | undefined,
        scrollContainer: HTMLElement | HTMLElement[] | null,
        coordinates?: {depth: number; top: number}
      ) => {
        if (!scrollContainer) {
          return;
        }
        if (node) {
          const lastCell = node.ref?.lastChild?.firstChild as
            | HTMLElement
            | null
            | undefined;
          if (lastCell) {
            lastCell.scrollIntoView({
              block: 'nearest',
            });

            const left = -328 + (node.item.depth * 14 + 8);
            if (Array.isArray(scrollContainer)) {
              scrollContainer.forEach(c => {
                c.scrollBy({
                  left,
                });
              });
            } else {
              scrollContainer.scrollBy({
                left,
              });
            }
          }
        } else if (coordinates && scrollContainer) {
          const left = -328 + (coordinates.depth * 14 + 8);

          if (Array.isArray(scrollContainer)) {
            scrollContainer.forEach(c => {
              c.scrollBy({
                left,
              });
            });
          } else {
            scrollContainer.scrollBy({
              left,
            });
          }
        }
      },
      []
    );

  const virtualizedTree = useMemo(() => {
    return VirtualizedTree.fromRoots(tree ?? []);
  }, [tree]);

  const scrollContainers = useMemo(() => {
    return [scrollContainerRef, dynamicScrollContainerRef].filter(
      c => !!c
    ) as HTMLElement[];
  }, [dynamicScrollContainerRef, scrollContainerRef]);

  const {
    items: renderItems,
    scrollContainerStyles: scrollContainerStyles,
    containerStyles: fixedContainerStyles,
    handleSortingChange,
    handleScrollTo,
    handleExpandTreeNode,
    handleRowClick,
    handleRowKeyDown,
    handleRowMouseEnter,
    selectedNodeIndex,
    clickedGhostRowRef: clickedGhostRowRef,
    hoveredGhostRowRef: hoveredGhostRowRef,
  } = useVirtualizedTree({
    expanded,
    skipFunction: recursion === 'collapsed' ? skipRecursiveNodes : undefined,
    sortFunction,
    onScrollToNode,
    scrollContainer: scrollContainers,
    rowHeight: 24,
    tree,
    virtualizedTree,
  });

  const onSortChange = useCallback(
    (newSort: 'sample count' | 'duration' | 'name') => {
      const newDirection =
        newSort === sort ? (direction === 'asc' ? 'desc' : 'asc') : 'desc';

      setDirection(newDirection);
      setSort(newSort);

      const sortFn = makeSortFunction(newSort, newDirection);
      handleSortingChange(sortFn);
    },
    [sort, direction, handleSortingChange]
  );

  useEffect(() => {
    function onShowInTableView(frame: FlamegraphFrame) {
      handleScrollTo(el => el.node === frame.node);
    }

    canvasScheduler.on('zoom at frame', onShowInTableView);
    canvasScheduler.on('show in table view', onShowInTableView);
    return () => {
      canvasScheduler.off('show in table view', onShowInTableView);
      canvasScheduler.off('zoom at frame', onShowInTableView);
    };
  }, [canvasScheduler, handleScrollTo]);

  const onSortBySampleCount = useCallback(() => {
    onSortChange('sample count');
  }, [onSortChange]);

  const onSortByName = useCallback(() => {
    onSortChange('name');
  }, [onSortChange]);

  const onSortByDuration = useCallback(() => {
    onSortChange('duration');
  }, [onSortChange]);

  return (
    <FrameBar>
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <FrameWeightCell>
            <TableHeaderButton onClick={onSortBySampleCount}>
              <InteractionStateLayer />
              <span>
                {t('Samples')}{' '}
                <QuestionTooltip
                  title={t('How often this frame appeared in stack samples.')}
                  size="sm"
                  position="top"
                />
              </span>
              {sort === 'sample count' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameWeightCell>
            <TableHeaderButton onClick={onSortByDuration}>
              <InteractionStateLayer />
              <span>
                {t('Duration')}{' '}
                <QuestionTooltip
                  title={t('Aggregated duration of this frame across different samples')}
                  size="sm"
                  position="top"
                />
              </span>
              {sort === 'duration' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameNameCell>
            <TableHeaderButton onClick={onSortByName}>
              <InteractionStateLayer />
              {t('Frame')}{' '}
              {sort === 'name' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameNameCell>
        </FrameCallersTableHeader>
        <AggregateFlamegraphTableContainer ref={setTableParentContainer}>
          <AggregateFlamegraphTreeContextMenu
            onBottomUpClick={() => setTreeView('bottom up')}
            onTopDownClick={() => setTreeView('top down')}
            contextMenu={contextMenu}
          />
          <FixedTableItemsContainer>
            {/*
          The order of these two matters because we want clicked state to
          be on top of hover in cases where user is hovering a clicked row.
           */}
            <div ref={setFixedScrollContainerRef} style={scrollContainerStyles}>
              <div style={fixedContainerStyles}>
                {renderItems.map(r => {
                  return fixedRenderRow(r, {
                    handleRowClick: handleRowClick(r.key),
                    handleRowMouseEnter: handleRowMouseEnter(r.key),
                    handleExpandTreeNode,
                    handleRowKeyDown,
                    selectedNodeIndex,
                  });
                })}
                <div className={FastFrameCallersTableClassNames.GHOST_ROW_CONTAINER}>
                  <div className={FastFrameCallersTableClassNames.GHOST_ROW_CELL} />
                  <div className={FastFrameCallersTableClassNames.GHOST_ROW_CELL} />
                </div>
              </div>
            </div>
          </FixedTableItemsContainer>
          <DynamicTableItemsContainer>
            {/*
          The order of these two matters because we want clicked state to
          be on top of hover in cases where user is hovering a clicked row.
           */}
            <div ref={setDynamicScrollContainerRef} style={scrollContainerStyles}>
              <div style={fixedContainerStyles}>
                {renderItems.map(r => {
                  return dynamicRenderRow(r, {
                    handleRowClick: handleRowClick(r.key),
                    handleRowMouseEnter: handleRowMouseEnter(r.key),
                    handleExpandTreeNode,
                    handleRowKeyDown,
                    selectedNodeIndex,
                  });
                })}
              </div>
            </div>
          </DynamicTableItemsContainer>
          <div ref={hoveredGhostRowRef} style={{zIndex: 0}} />
          <div ref={clickedGhostRowRef} style={{zIndex: 0}} />
        </AggregateFlamegraphTableContainer>
      </FrameCallersTable>
    </FrameBar>
  );
}

const AggregateFlamegraphTableContainer = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
`;

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;
const FixedTableItemsContainer = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: ${2 * FRAME_WEIGHT_CELL_WIDTH_PX}px;
  overflow: hidden;
  z-index: 1;

  /* Hide scrollbar so we dont end up with double scrollbars */
  > div {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

const DynamicTableItemsContainer = styled('div')`
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: calc(100% - ${2 * FRAME_WEIGHT_CELL_WIDTH_PX}px);
  overflow: hidden;
  z-index: 1;
`;

const TableHeaderButton = styled('button')`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${space(1)};
  border: none;
  background-color: ${props => props.theme.surface200};
  transition: background-color 100ms ease-in-out;
  line-height: 24px;

  svg {
    width: 10px;
    height: 10px;
  }
`;

const FrameBar = styled('div')`
  overflow: auto;
  width: 100%;
  position: relative;
  background-color: ${p => p.theme.surface200};
  border-top: 1px solid ${p => p.theme.border};
  flex: 1 1 100%;
  grid-area: table;
`;

const FrameWeightCell = styled('div')`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
`;

const FrameNameCell = styled('div')`
  flex: 1 1 100%;
`;

const FrameCallersTableHeader = styled('div')`
  top: 0;
  position: sticky;
  z-index: 2;
  display: flex;

  > div {
    position: relative;
    border-bottom: 1px solid ${p => p.theme.border};
    background-color: ${p => p.theme.background};
    white-space: nowrap;

    &:last-child {
      flex: 1;
    }

    &:not(:last-child) {
      border-right: 1px solid ${p => p.theme.border};
    }
  }
`;
