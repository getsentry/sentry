import {forwardRef, Fragment} from 'react';
import styled from '@emotion/styled';

import {IconSettings} from 'sentry/icons/iconSettings';
import {IconUser} from 'sentry/icons/iconUser';
import {space} from 'sentry/styles/space';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import {VirtualizedTreeRenderedRow} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';

export const enum CallTreeTableClassNames {
  ROW = 'CallTreeTableRow',
  CELL = 'CallTreeTableTableCell',
  FRAME_CELL = 'CallTreeTableTableCellFrame',
  WEIGHT = 'CallTreeTableTableCellWeight',
  BACKGROUND_WEIGHT = 'CallTreeTableTableCellWeightBar',
  FRAME_TYPE = 'CallTreeTableTableCellFrameType',
  COLOR_INDICATOR = 'CallTreeTableTableCellColorIndicator',
  EXPAND_BUTTON = 'CallTreeTableTableCellExpandButton',
  GHOST_ROW_CELL = 'CallTreeTableTableCellGhostRow',
  GHOST_ROW_CONTAINER = 'CallTreeTableTableCellGhostRowContainer',
}

export const CallTreeTable = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin: 0;
  overflow: auto;
  max-height: 100%;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.background};

  .${CallTreeTableClassNames.ROW} {
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

      .${CallTreeTableClassNames.WEIGHT} {
        color: ${p => p.theme.white};
        opacity: 0.7;
      }

      .${CallTreeTableClassNames.BACKGROUND_WEIGHT} {
        background-color: ${props => props.theme.yellow100};
        border-bottom: 1px solid ${props => props.theme.yellow200};
      }

      .${CallTreeTableClassNames.FRAME_TYPE} {
        color: ${p => p.theme.white};
        opacity: 0.7;
      }
    }

    &[data-hovered='true']:not([tabindex='0']) {
      background: ${p => p.theme.surface200};
    }
  }

  .${CallTreeTableClassNames.CELL} {
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

  .${CallTreeTableClassNames.FRAME_CELL} {
    display: flex;
    align-items: center;
    padding: 0 ${space(1)};
    white-space: nowrap;

    &:focus {
      outline: none;
    }
  }
  .${CallTreeTableClassNames.WEIGHT} {
    display: inline-block;
    min-width: 7ch;
    padding-right: 0px;
    color: ${p => p.theme.subText};
    opacity: 1;
  }
  .${CallTreeTableClassNames.BACKGROUND_WEIGHT} {
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

  .${CallTreeTableClassNames.FRAME_TYPE} {
    flex-shrink: 0;
    width: 26px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${p => p.theme.subText};
    opacity: ${_p => 1};
  }

  .${CallTreeTableClassNames.COLOR_INDICATOR} {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    display: inline-block;
    flex-shrink: 0;
    margin-right: ${space(0.5)};
  }

  .${CallTreeTableClassNames.EXPAND_BUTTON} {
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

  .${CallTreeTableClassNames.GHOST_ROW_CELL} {
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

  .${CallTreeTableClassNames.GHOST_ROW_CONTAINER} {
    display: flex;
    width: 100%;
    pointer-events: none;
    position: absolute;
    height: 100%;
  }
`;

export const CALL_TREE_FRAME_WEIGHT_CELL_WIDTH_PX = 164;

export const CallTreeFixedColumnsContainer = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: ${2 * CALL_TREE_FRAME_WEIGHT_CELL_WIDTH_PX}px;
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

export const CallTreeDynamicColumnsContainer = styled('div')`
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: calc(100% - ${2 * CALL_TREE_FRAME_WEIGHT_CELL_WIDTH_PX}px);
  overflow: hidden;
  z-index: 1;
`;

export const CallTreeTableHeader = styled('div')`
  top: 0;
  z-index: 2;
  display: flex;
  flex: 1;
  flex-grow: 0;

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

export const CallTreeTableHeaderButton = styled('button')`
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

export const CallTreeTableContainer = styled('div')`
  position: relative;
  height: 100%;
`;

type SyncCallTreeScrollParams = {
  node: VirtualizedTreeRenderedRow<FlamegraphFrame> | undefined;
  scrollContainer: HTMLElement | HTMLElement[] | null;
  coordinates?: {depth: number; top: number};
};

// This is slighlty unfortunate and ugly, but because our two columns are sticky
// we need to scroll the container to the left when we scroll to a node. This
// should be resolved when we split the virtualization between containers and sync scroll,
// but is a larger undertaking and will take a bit longer
export function syncCallTreeTableScroll(args: SyncCallTreeScrollParams) {
  if (!args.scrollContainer) {
    return;
  }
  if (args.node) {
    const lastCell = args.node.ref?.lastChild?.firstChild as
      | HTMLElement
      | null
      | undefined;
    if (lastCell) {
      lastCell.scrollIntoView({
        block: 'nearest',
      });

      const left = -328 + (args.node.item.depth * 14 + 8);
      if (Array.isArray(args.scrollContainer)) {
        args.scrollContainer.forEach(c => {
          c.scrollBy({
            left,
          });
        });
      } else {
        args.scrollContainer.scrollBy({
          left,
        });
      }
    }
  } else if (args.coordinates && args.scrollContainer) {
    const left = -328 + (args.coordinates.depth * 14 + 8);

    if (Array.isArray(args.scrollContainer)) {
      args.scrollContainer.forEach(c => {
        c.scrollBy({
          left,
        });
      });
    } else {
      args.scrollContainer.scrollBy({
        left,
      });
    }
  }
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

const TEXT_ALIGN_RIGHT: React.CSSProperties = {textAlign: 'right'};

interface CallTreeTableRowProps {
  children: React.ReactNode;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onMouseEnter: () => void;
  tabIndex: number;
  top: string;
}
export const CallTreeTableRow = forwardRef<HTMLDivElement, CallTreeTableRowProps>(
  (props, ref) => {
    return (
      <div
        ref={ref}
        className={CallTreeTableClassNames.ROW}
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

interface CallTreeTableColumns {
  formatDuration: (value: number) => string;
  frameColor: string;
  node: VirtualizedTreeNode<FlamegraphFrame>;
  onExpandClick: (
    node: VirtualizedTreeNode<FlamegraphFrame>,
    expand: boolean,
    opts?: {expandChildren: boolean}
  ) => void;
  referenceNode: FlamegraphFrame;
  relativeSelfWeight: number;
  relativeTotalWeight: number;
  selfWeight: number | React.ReactNode;
  tabIndex: number;
  totalWeight: number | React.ReactNode;
  type: 'count' | 'time';
}

export function CallTreeTableFixedColumns(props: CallTreeTableColumns) {
  return (
    <Fragment>
      <div className={CallTreeTableClassNames.CELL} style={TEXT_ALIGN_RIGHT}>
        {typeof props.selfWeight === 'number'
          ? props.formatDuration(props.selfWeight)
          : props.selfWeight}
        <div className={CallTreeTableClassNames.WEIGHT}>
          {props.relativeSelfWeight.toFixed(1)}%
          <div
            className={CallTreeTableClassNames.BACKGROUND_WEIGHT}
            style={{transform: `scaleX(${props.relativeSelfWeight / 100})`}}
          />
        </div>
      </div>
      <div className={CallTreeTableClassNames.CELL} style={TEXT_ALIGN_RIGHT}>
        {typeof props.totalWeight === 'number'
          ? props.formatDuration(props.totalWeight)
          : props.totalWeight}
        <div className={CallTreeTableClassNames.WEIGHT}>
          {props.relativeTotalWeight.toFixed(1)}%
          <div
            className={CallTreeTableClassNames.BACKGROUND_WEIGHT}
            style={{transform: `scaleX(${props.relativeTotalWeight / 100})`}}
          />
        </div>
        <div className={CallTreeTableClassNames.FRAME_TYPE}>
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

export function CallTreeTableDynamicColumns(
  props: Omit<
    CallTreeTableColumns,
    'relativeTotalWeight' | 'relativeSelfWeight' | 'selfWeight' | 'totalWeight'
  >
) {
  const handleExpanding = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    props.onExpandClick(props.node, !props.node.expanded, {
      expandChildren: evt.metaKey,
    });
  };

  return (
    <div
      className={CallTreeTableClassNames.FRAME_CELL}
      style={{paddingLeft: props.node.depth * 14 + 8, width: '100%'}}
    >
      <div
        className={CallTreeTableClassNames.COLOR_INDICATOR}
        style={{backgroundColor: props.frameColor}}
      />
      <button
        className={CallTreeTableClassNames.EXPAND_BUTTON}
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

export function CallTreeTableGhostRow() {
  return (
    <div className={CallTreeTableClassNames.GHOST_ROW_CONTAINER}>
      <div className={CallTreeTableClassNames.GHOST_ROW_CELL} />
      <div className={CallTreeTableClassNames.GHOST_ROW_CELL} />
    </div>
  );
}
