import {forwardRef, Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {IconSettings, IconUser} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';

import {FrameCallersTableCell} from './flamegraphDrawer';

function computeRelativeWeight(base: number, value: number) {
  // Make sure we dont divide by zero
  if (!base || !value) {
    return 0;
  }
  return (value / base) * 100;
}

interface FlamegraphTreeTableRowProps {
  formatDuration: Flamegraph['formatter'];
  frameColor: string;
  node: VirtualizedTreeNode<FlamegraphFrame>;
  onClick: React.MouseEventHandler<HTMLDivElement>;
  onExpandClick: (
    node: VirtualizedTreeNode<FlamegraphFrame>,
    expand: boolean,
    opts?: {expandChildren: boolean}
  ) => void;
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  onMouseEnter: React.MouseEventHandler<HTMLDivElement>;
  referenceNode: FlamegraphFrame;
  style: React.CSSProperties;
  tabIndex: number;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
}

export const FlamegraphTreeTableRow = forwardRef<
  HTMLDivElement,
  FlamegraphTreeTableRowProps
>((props, ref) => {
  return (
    <FrameCallersRow
      ref={ref}
      style={props.style}
      onContextMenu={props.onContextMenu}
      tabIndex={props.tabIndex}
      isSelected={props.tabIndex === 0}
      onKeyDown={props.onKeyDown}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
    >
      <FrameCallersFixedRows {...props} />
      <FrameCallersFunctionRow {...props} />
    </FrameCallersRow>
  );
});

export function FrameCallersFunctionRow(
  props: Omit<FlamegraphTreeTableRowProps, 'style'>
) {
  const handleExpanding = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation();
      props.onExpandClick(props.node, !props.node.expanded, {
        expandChildren: evt.metaKey,
      });
    },
    [props]
  );

  return (
    <FrameCallersTableCell
      // We stretch this table to 100% width.
      style={{paddingLeft: props.node.depth * 14 + 8, width: '100%'}}
      className="FrameCallersTableCell"
    >
      <FrameNameContainer>
        {/* @TODO FIX COLOR */}
        <FrameColorIndicator style={{backgroundColor: props.frameColor}} />
        <FrameChildrenIndicator
          tabIndex={-1}
          onClick={handleExpanding}
          open={props.node.expanded}
        >
          {props.node.node.children.length > 0 ? '\u203A' : null}
        </FrameChildrenIndicator>
        <FrameName>{props.node.node.frame.name}</FrameName>
      </FrameNameContainer>
    </FrameCallersTableCell>
  );
}

export function FrameCallersFixedRows(props: Omit<FlamegraphTreeTableRowProps, 'style'>) {
  return (
    <Fragment>
      <FrameCallersTableCell
        className="FrameCallersTableCell"
        isSelected={props.tabIndex === 0}
        textAlign="right"
      >
        {props.formatDuration(props.node.node.node.selfWeight)}
        <Weight
          isSelected={props.tabIndex === 0}
          weight={computeRelativeWeight(
            props.referenceNode.node.totalWeight,
            props.node.node.node.selfWeight
          )}
        />
      </FrameCallersTableCell>
      <FrameCallersTableCell
        isSelected={props.tabIndex === 0}
        noPadding
        textAlign="right"
        className="FrameCallersTableCell"
      >
        <FrameWeightTypeContainer>
          <FrameWeightContainer>
            {props.formatDuration(props.node.node.node.totalWeight)}
            <Weight
              padded
              isSelected={props.tabIndex === 0}
              weight={computeRelativeWeight(
                props.referenceNode.node.totalWeight,
                props.node.node.node.totalWeight
              )}
            />
          </FrameWeightContainer>
          <FrameTypeIndicator isSelected={props.tabIndex === 0}>
            {props.node.node.node.frame.is_application ? (
              <IconUser size="xs" />
            ) : (
              <IconSettings size="xs" />
            )}
          </FrameTypeIndicator>
        </FrameWeightTypeContainer>
      </FrameCallersTableCell>
    </Fragment>
  );
}
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

export const FrameCallersRow = styled('div')<{isSelected: boolean}>`
  display: flex;
  width: 100%;
  color: ${p => (p.isSelected ? p.theme.white : 'inherit')};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 24px;

  &:focus {
    outline: none;
  }

  &[data-hovered='true']:not([tabindex='0']) {
    > div:first-child,
    > div:nth-child(2) {
      background-color: ${p => p.theme.surface200} !important;
    }
  }
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
