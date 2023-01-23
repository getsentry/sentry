import {CSSProperties, forwardRef} from 'react';
import styled from '@emotion/styled';

import {IconSettings, IconUser} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';

import {VirtualizedTreeRenderedRow} from '../../../../utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';

function computeRelativeWeight(base: number, value: number) {
  // Make sure we dont divide by zero
  if (!base || !value) {
    return 0;
  }
  return (value / base) * 100;
}

export const FrameSelfWeightCell = forwardRef(
  (
    {
      style,
      node,
      referenceNode,
      formatDuration,
    }: {
      formatDuration: Flamegraph['formatter'];
      node: VirtualizedTreeNode<FlamegraphFrame>;
      referenceNode: FlamegraphFrame;
      tabIndex: number;
      style?: CSSProperties;
    },
    ref: React.Ref<HTMLDivElement> | null
  ) => {
    const weight = computeRelativeWeight(
      referenceNode.node.totalWeight,
      node.node.node.selfWeight
    );
    return (
      <FrameCallersTableCellRight ref={ref} style={style}>
        {formatDuration(node.node.node.selfWeight)}
        <Weight>
          {weight.toFixed(1)}%
          <BackgroundWeightBar style={{transform: `scaleX(${weight / 100})`}} />
        </Weight>
      </FrameCallersTableCellRight>
    );
  }
);

export const FrameTotalWeightCell = forwardRef(
  (
    {
      style,
      node,
      referenceNode,
      formatDuration,
    }: {
      formatDuration: Flamegraph['formatter'];
      node: VirtualizedTreeNode<FlamegraphFrame>;
      referenceNode: FlamegraphFrame;
      tabIndex: number;
      style?: CSSProperties;
    },
    ref: React.Ref<HTMLDivElement> | null
  ) => {
    const weight = computeRelativeWeight(
      referenceNode.node.totalWeight,
      node.node.node.totalWeight
    );
    return (
      <FrameCallersTableCellRight ref={ref} style={style}>
        <FrameWeightTypeContainer>
          <FrameWeightContainer>
            {formatDuration(node.node.node.totalWeight)}
            <Weight>
              {weight.toFixed(1)}%
              <BackgroundWeightBar style={{transform: `scaleX(${weight / 100})`}} />
            </Weight>
          </FrameWeightContainer>
          <FrameTypeIndicator>
            {node.node.node.frame.is_application ? (
              <IconUser size="xs" />
            ) : (
              <IconSettings size="xs" />
            )}
          </FrameTypeIndicator>
        </FrameWeightTypeContainer>
      </FrameCallersTableCellRight>
    );
  }
);

export const FrameCell = forwardRef(
  (
    {
      row,
      color,
      tabIndex,
      style,
      onClick,
      onKeyDown,
      onMouseEnter,
      onExpandClick,
    }: {
      color: string;
      onClick: () => any;
      onExpandClick: () => any;
      onKeyDown: () => any;
      onMouseEnter: () => any;
      row: VirtualizedTreeRenderedRow<FlamegraphFrame>;
      tabIndex: number;
      style?: CSSProperties;
    },
    ref: React.Ref<HTMLDivElement> | null
  ) => {
    return (
      <FrameCallersTableCellLeft
        ref={ref}
        tabIndex={tabIndex}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onMouseEnter={onMouseEnter}
        style={{
          width: '100%',
          position: 'absolute',
          height: style?.height ?? 0,
          border: 'none',
          paddingLeft: 8,
          transform: `translate(${row.item.depth * 14}px, ${row.position.top}px)`,
        }}
      >
        <FrameNameContainer>
          <FrameColorIndicator style={{backgroundColor: color}} />
          <FrameChildrenIndicator
            tabIndex={-1}
            onClick={onExpandClick}
            style={{transform: row.item.expanded ? 'rotate(90deg)' : 'rotate(0deg)'}}
          >
            {row.item.node.children.length > 0 ? '\u203A' : null}
          </FrameChildrenIndicator>
          <FrameName>{row.item.node.frame.name}</FrameName>
        </FrameNameContainer>
      </FrameCallersTableCellLeft>
    );
  }
);

const Weight = styled('div')`
  display: inline-block;
  min-width: 7ch;
  padding-right: ${space(0.5)};
  color: ${p => p.theme.subText};
  opacity: 1;
`;

const FrameWeightContainer = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  justify-content: flex-end;
  flex: 1 1 100%;
  height: 100%;
`;

const FrameWeightTypeContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  flex: 1 1 100%;
  height: 100%;
`;

const FrameTypeIndicator = styled('div')`
  flex-shrink: 0;
  width: 26px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.subText};
  opacity: 0.8;
`;

const BackgroundWeightBar = styled('div')`
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 0;
  background-color: ${props => props.theme.yellow100};
  border-bottom: 1px solid ${props => props.theme.yellow200};
  transform-origin: center right;
  height: 100%;
  width: 100%;
`;

const FrameNameContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const FrameChildrenIndicator = styled('button')`
  width: 10px;
  height: 10px;
  display: flex;
  padding: 0;
  border: none;
  background-color: transparent;
  align-items: center;
  justify-content: center;
  user-select: none;
`;

const FrameName = styled('span')`
  margin-left: ${space(0.5)};
`;

const FrameColorIndicator = styled('div')`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
  flex-shrink: 0;
  margin-right: ${space(0.5)};
`;

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;
export const FrameCallersTableCellLeft = styled('div')`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0;
  text-align: left;
  justify-content: flex-start;
  border-right: 1px solid ${p => p.theme.border};

  &:focus {
    outline: none;
  }
`;

export const FrameCallersTableCellRight = styled('div')`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0;
  text-align: right;
  justify-content: flex-end;
  border-right: 1px solid ${p => p.theme.border};

  &:focus {
    outline: none;
  }
`;
