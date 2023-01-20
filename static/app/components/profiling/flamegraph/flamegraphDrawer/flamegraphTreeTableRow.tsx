import {CSSProperties, forwardRef} from 'react';
import styled from '@emotion/styled';

import {IconSettings, IconUser} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';

function computeRelativeWeight(base: number, value: number) {
  // Make sure we dont divide by zero
  if (!base || !value) {
    return 0;
  }
  return (value / base) * 100;
}

export function FrameSelfWeightCell({
  style,
  tabIndex,
  node,
  referenceNode,
  formatDuration,
}: {
  formatDuration: Flamegraph['formatter'];
  node: VirtualizedTreeNode<FlamegraphFrame>;
  referenceNode: FlamegraphFrame;
  tabIndex: number;
  style?: CSSProperties;
}) {
  return (
    <FrameCallersTableCell style={style} isSelected={tabIndex === 0} align="right">
      {formatDuration(node.node.node.selfWeight)}
      <Weight
        isSelected={tabIndex === 0}
        weight={computeRelativeWeight(
          referenceNode.node.totalWeight,
          node.node.node.selfWeight
        )}
      />
    </FrameCallersTableCell>
  );
}

export function FrameTotalWeightCell({
  style,
  tabIndex,
  node,
  referenceNode,
  formatDuration,
}: {
  formatDuration: Flamegraph['formatter'];
  node: VirtualizedTreeNode<FlamegraphFrame>;
  referenceNode: FlamegraphFrame;
  tabIndex: number;
  style?: CSSProperties;
}) {
  return (
    <FrameCallersTableCell
      style={style}
      isSelected={tabIndex === 0}
      noPadding
      align="right"
    >
      <FrameWeightTypeContainer>
        <FrameWeightContainer>
          {formatDuration(node.node.node.totalWeight)}
          <Weight
            padded
            isSelected={tabIndex === 0}
            weight={computeRelativeWeight(
              referenceNode.node.totalWeight,
              node.node.node.totalWeight
            )}
          />
        </FrameWeightContainer>
        <FrameTypeIndicator isSelected={tabIndex === 0}>
          {node.node.node.frame.is_application ? (
            <IconUser size="xs" />
          ) : (
            <IconSettings size="xs" />
          )}
        </FrameTypeIndicator>
      </FrameWeightTypeContainer>
    </FrameCallersTableCell>
  );
}

export const FrameCell = forwardRef(
  (
    {
      node,
      color,
      style,
      tabIndex,
      onClick,
      onKeyDown,
      onMouseEnter,
      onExpandClick,
    }: {
      color: string;
      node: VirtualizedTreeNode<FlamegraphFrame>;
      onClick: () => any;
      onExpandClick: () => any;
      onKeyDown: () => any;
      onMouseEnter: () => any;
      tabIndex: number;
      style?: CSSProperties;
    },
    ref: React.Ref<HTMLDivElement> | null
  ) => {
    return (
      <FrameCallersTableCell
        ref={ref}
        tabIndex={tabIndex}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onMouseEnter={onMouseEnter}
        isSelected={tabIndex === 0}
        style={{
          ...style,
          border: 'none',
          paddingLeft: node.depth * 14 + 8,
          width: '100%',
        }}
      >
        <FrameNameContainer>
          <FrameColorIndicator style={{backgroundColor: color}} />
          <FrameChildrenIndicator
            tabIndex={-1}
            onClick={onExpandClick}
            open={node.expanded}
          >
            {node.node.children.length > 0 ? '\u203A' : null}
          </FrameChildrenIndicator>
          <FrameName>{node.node.frame.name}</FrameName>
        </FrameNameContainer>
      </FrameCallersTableCell>
    );
  }
);

const Weight = styled(
  (props: {isSelected: boolean; weight: number; padded?: boolean}) => {
    const {weight, padded: __, isSelected: _, ...rest} = props;
    return (
      <div {...rest}>
        {weight.toFixed(1)}%
        <BackgroundWeightBar style={{transform: `scaleX(${weight / 100})`}} />
      </div>
    );
  }
)`
  display: inline-block;
  min-width: 7ch;
  padding-right: ${p => (p.padded ? space(0.5) : 0)};
  color: ${p => (p.isSelected ? p.theme.white : p.theme.subText)};
  opacity: ${p => (p.isSelected ? 0.8 : 1)};
`;

const FrameWeightTypeContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  position: relative;
`;

const FrameTypeIndicator = styled('div')<{isSelected: boolean}>`
  flex-shrink: 0;
  width: 26px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => (p.isSelected ? p.theme.white : p.theme.subText)};
  opacity: ${p => (p.isSelected ? 0.8 : 1)};
`;

const FrameWeightContainer = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  justify-content: flex-end;
  flex: 1 1 100%;
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

const FrameChildrenIndicator = styled('button')<{open: boolean}>`
  width: 10px;
  height: 10px;
  display: flex;
  padding: 0;
  border: none;
  background-color: transparent;
  align-items: center;
  justify-content: center;
  user-select: none;
  transform: ${p => (p.open ? 'rotate(90deg)' : 'rotate(0deg)')};
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
export const FrameCallersTableCell = styled('div')<{
  align?: 'right' | 'left';
  isSelected?: boolean;
  noPadding?: boolean;
}>`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 ${p => (p.noPadding ? 0 : space(1))} 0 0;
  text-align: ${p => (p.align === 'right' ? 'right' : 'left')};
  justify-content: ${p => (p.align === 'right' ? 'flex-end' : 'flex-start')};
  border-right: 1px solid ${p => p.theme.border};

  &:focus {
    outline: none;
  }
`;
