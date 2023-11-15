import {forwardRef, Fragment} from 'react';
import styled from '@emotion/styled';

import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconSettings} from 'sentry/icons/iconSettings';
import {IconUser} from 'sentry/icons/iconUser';
import {space} from 'sentry/styles/space';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';

export const enum CallTreeTableClassNames {
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

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;

export const FixedColumnsContainer = styled('div')`
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

export const DynamicColumnsContainer = styled('div')`
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: calc(100% - ${2 * FRAME_WEIGHT_CELL_WIDTH_PX}px);
  overflow: hidden;
  z-index: 1;
`;

function computeRelativeWeight(base: number, value: number) {
  // Make sure we dont divide by zero
  if (!base || !value) {
    return 0;
  }
  return (value / base) * 100;
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
  tabIndex: number;
}

export function CallTreeTableDynamicColumns(props: CallTreeTableColumns) {
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
      <div className={CallTreeTableClassNames.CELL} style={TEXT_ALIGN_RIGHT}>
        {props.node.node.node.totalWeight}
        <div className={CallTreeTableClassNames.WEIGHT}>
          {totalWeight.toFixed(2)}%
          <div
            className={CallTreeTableClassNames.BACKGROUND_WEIGHT}
            style={{transform: `scaleX(${totalWeight / 100})`}}
          />
        </div>
      </div>
      <div className={CallTreeTableClassNames.CELL} style={TEXT_ALIGN_RIGHT}>
        <PerformanceDuration
          nanoseconds={props.node.node.node.aggregate_duration_ns}
          abbreviation
        />
        <div className={CallTreeTableClassNames.WEIGHT}>
          {totalAggregateDuration.toFixed(2)}%
          <div
            className={CallTreeTableClassNames.BACKGROUND_WEIGHT}
            style={{transform: `scaleX(${totalAggregateDuration / 100})`}}
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

export function CallTreeTableFixedColumns(props: CallTreeTableColumns) {
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
