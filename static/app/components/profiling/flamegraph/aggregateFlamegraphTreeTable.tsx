import {forwardRef, Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {FrameCallersTableCell} from 'sentry/components/profiling/flamegraph/flamegraphDrawer/flamegraphDrawer';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow, IconSettings, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
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
import {useFlamegraph} from 'sentry/views/profiling/flamegraphProvider';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {FlamegraphTreeContextMenu} from './flamegraphDrawer/flamegraphTreeContextMenu';

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
}

interface FastFrameCallersRowsProps {
  formatDuration: (value: number) => string;
  frameColor: string;
  node: VirtualizedTreeNode<FlamegraphFrame>;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onExpandClick: (
    node: VirtualizedTreeNode<FlamegraphFrame>,
    expand: boolean,
    opts?: {expandChildren: boolean}
  ) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onMouseEnter: () => void;
  referenceNode: FlamegraphFrame;
  tabIndex: number;
}

interface FastFrameCallerRowProps {
  children: React.ReactNode;
  top: string;
}
const FastFrameCallersRow = forwardRef<HTMLDivElement, FastFrameCallerRowProps>(
  (props, ref) => {
    return (
      <div
        ref={ref}
        className={FastFrameCallersTableClassNames.ROW}
        style={{top: props.top}}
      >
        {props.children}
      </div>
    );
  }
);

const TEXT_ALIGN_RIGHT: React.CSSProperties = {textAlign: 'right'};
function FastFrameCallersFixedRows(props: FastFrameCallersRowsProps) {
  const selfWeight = computeRelativeWeight(
    props.referenceNode.node.totalWeight,
    props.node.node.node.selfWeight
  );

  const totalWeight = computeRelativeWeight(
    props.referenceNode.node.totalWeight,
    props.node.node.node.totalWeight
  );

  return (
    <Fragment>
      <div className={FastFrameCallersTableClassNames.CELL} style={TEXT_ALIGN_RIGHT}>
        {props.formatDuration(props.node.node.node.selfWeight)}
        <div className={FastFrameCallersTableClassNames.WEIGHT}>
          {selfWeight.toFixed(1)}%
          <div
            className={FastFrameCallersTableClassNames.BACKGROUND_WEIGHT}
            style={{transform: `scaleX(${selfWeight / 100})`}}
          />
        </div>
      </div>
      <div className={FastFrameCallersTableClassNames.CELL} style={TEXT_ALIGN_RIGHT}>
        {props.formatDuration(props.node.node.node.totalWeight)}
        <div className={FastFrameCallersTableClassNames.WEIGHT}>
          {totalWeight.toFixed(1)}%
          <div
            className={FastFrameCallersTableClassNames.BACKGROUND_WEIGHT}
            style={{transform: `scaleX(${totalWeight / 100})`}}
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

  .${FastFrameCallersTableClassNames.ROW} {
    display: flex;
    line-height: 24px;
    font-size: 12px;
    position: absolute;
    width: 100%;
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
  }

  .${FastFrameCallersTableClassNames.FRAME_CELL} {
    display: flex;
    align-items: center;
    padding: 0 ${space(1)};
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
  }
`;

function makeSortFunction(
  property: 'total weight' | 'self weight' | 'name',
  direction: 'asc' | 'desc'
) {
  if (property === 'total weight') {
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
  canvasPoolManager,
  canvasScheduler,
  recursion,
  frameFilter,
}: AggregateFlamegraphTreeTableProps) {
  const dispatch = useDispatchFlamegraphState();
  const {colorCoding} = useFlamegraphPreferences();
  const profiles = useFlamegraphProfiles();
  const profileGroup = useProfileGroup();
  const flamegraph = useFlamegraph();
  const theme = useFlamegraphTheme();
  const referenceNode = flamegraph.root;

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
      frameFilter !== 'all' ? filterFlamegraphTree(rootNodes, skipFunction) : rootNodes;

    return invertCallTree(maybeFilteredRoots);
  }, [frameFilter, rootNodes]);

  const {colorMap} = useMemo(() => {
    return theme.COLORS.STACK_TO_COLOR(
      flamegraph.frames,
      theme.COLORS.COLOR_MAPS[colorCoding],
      theme.COLORS.COLOR_BUCKET,
      theme
    );
  }, [theme, flamegraph.frames, colorCoding]);

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
  const [sort, setSort] = useState<'total weight' | 'self weight' | 'name'>(
    'total weight'
  );
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sortFunction = useMemo(() => {
    return makeSortFunction(sort, direction);
  }, [sort, direction]);

  const [clickedContextMenuNode, setClickedContextMenuClose] =
    useState<VirtualizedTreeNode<FlamegraphFrame> | null>(null);
  const contextMenu = useContextMenu({container: scrollContainerRef});

  const handleZoomIntoFrameClick = useCallback(() => {
    if (!clickedContextMenuNode) {
      return;
    }

    canvasPoolManager.dispatch('zoom at frame', [clickedContextMenuNode.node, 'exact']);
    canvasPoolManager.dispatch('highlight frame', [
      [clickedContextMenuNode.node],
      'selected',
    ]);
  }, [canvasPoolManager, clickedContextMenuNode]);

  const onHighlightAllOccurencesClick = useCallback(() => {
    if (!clickedContextMenuNode) {
      return;
    }

    canvasPoolManager.dispatch('highlight frame', [
      flamegraph.findAllMatchingFrames(
        clickedContextMenuNode.node.frame.name,
        clickedContextMenuNode.node.frame.package ??
          clickedContextMenuNode.node.frame.module ??
          ''
      ),
      'selected',
    ]);
  }, [canvasPoolManager, clickedContextMenuNode, flamegraph]);

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
          >
            <FastFrameCallersFixedRows
              node={r.item}
              referenceNode={referenceNode}
              frameColor={getFrameColor(r.item.node)}
              formatDuration={flamegraph.formatter}
              tabIndex={selectedNodeIndex === r.key ? 0 : 1}
              onClick={handleRowClick}
              onExpandClick={handleExpandTreeNode}
              onKeyDown={handleRowKeyDown}
              onMouseEnter={handleRowMouseEnter}
              onContextMenu={evt => {
                setClickedContextMenuClose(r.item);
                contextMenu.handleContextMenu(evt);
              }}
            />
          </FastFrameCallersRow>
        );
      },
      [contextMenu, referenceNode, flamegraph.formatter, getFrameColor]
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
          >
            <FastFrameCallersDynamicRows
              node={r.item}
              referenceNode={referenceNode}
              frameColor={getFrameColor(r.item.node)}
              formatDuration={flamegraph.formatter}
              tabIndex={selectedNodeIndex === r.key ? 0 : 1}
              onClick={handleRowClick}
              onExpandClick={handleExpandTreeNode}
              onKeyDown={handleRowKeyDown}
              onMouseEnter={handleRowMouseEnter}
              onContextMenu={evt => {
                setClickedContextMenuClose(r.item);
                contextMenu.handleContextMenu(evt);
              }}
            />
          </FastFrameCallersRow>
        );
      },
      [contextMenu, referenceNode, flamegraph.formatter, getFrameColor]
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
    (newSort: 'total weight' | 'self weight' | 'name') => {
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

    canvasScheduler.on('show in table view', onShowInTableView);
    return () => canvasScheduler.off('show in table view', onShowInTableView);
  }, [canvasScheduler, handleScrollTo]);

  const onSortBySelfWeight = useCallback(() => {
    onSortChange('self weight');
  }, [onSortChange]);

  const onSortByTotalWeight = useCallback(() => {
    onSortChange('total weight');
  }, [onSortChange]);

  const onSortByName = useCallback(() => {
    onSortChange('name');
  }, [onSortChange]);

  return (
    <FrameBar>
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <FrameWeightCell>
            <TableHeaderButton onClick={onSortBySelfWeight}>
              <InteractionStateLayer />
              <span>
                {t('Self Time')}{' '}
                <QuestionTooltip
                  title={t(
                    'Self time is the amount of time spent by this function excluding the time spent by other functions called within it.'
                  )}
                  size="sm"
                  position="top"
                />
              </span>
              {sort === 'self weight' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameWeightCell>
            <TableHeaderButton onClick={onSortByTotalWeight}>
              <InteractionStateLayer />
              <span>
                {t('Total Time')}{' '}
                <QuestionTooltip
                  title={t(
                    'Total time is the total amount of time spent by this function.'
                  )}
                  size="sm"
                  position="top"
                />
              </span>
              {sort === 'total weight' ? (
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
        <FlamegraphTreeContextMenu
          onZoomIntoFrameClick={handleZoomIntoFrameClick}
          onHighlightAllFramesClick={onHighlightAllOccurencesClick}
          contextMenu={contextMenu}
        />
        <FixedTableItemsContainer>
          {/*
          The order of these two matters because we want clicked state to
          be on top of hover in cases where user is hovering a clicked row.
           */}
          <div ref={hoveredGhostRowRef} />
          <div ref={clickedGhostRowRef} />
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
              <GhostRowContainer>
                <FrameCallersTableCell bordered />
                <FrameCallersTableCell bordered />
              </GhostRowContainer>
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
      </FrameCallersTable>
    </FrameBar>
  );
}

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;
const FixedTableItemsContainer = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX * 2}px;
  overflow: hidden;
  background: ${p => p.theme.background};
`;

const DynamicTableItemsContainer = styled('div')`
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: calc(100% - ${2 * FRAME_WEIGHT_CELL_WIDTH_PX}px);
  overflow: hidden;
  background: ${p => p.theme.background};
`;

const GhostRowContainer = styled('div')`
  display: flex;
  width: 100%;
  pointer-events: none;
  position: absolute;
  height: 100%;
  z-index: -1;
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
  z-index: 1;
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
