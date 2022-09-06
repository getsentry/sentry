import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import space from 'sentry/styles/space';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {formatColorForFrame, Rect} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

import {BoundTooltip} from './boundTooltip';

function formatWeightToProfileDuration(frame: CallTreeNode, flamegraph: Flamegraph) {
  return `(${Math.round((frame.totalWeight / flamegraph.profile.duration) * 100)}%)`;
}

export interface FlamegraphTooltipProps {
  canvasBounds: Rect;
  configSpaceCursor: vec2;
  flamegraphCanvas: FlamegraphCanvas;
  flamegraphRenderer: FlamegraphRenderer;
  flamegraphView: FlamegraphView;
  frame: FlamegraphFrame;
  platform: 'javascript' | 'python' | 'ios' | 'android';
}

export function FlamegraphTooltip(props: FlamegraphTooltipProps) {
  return (
    <BoundTooltip
      bounds={props.canvasBounds}
      cursor={props.configSpaceCursor}
      flamegraphCanvas={props.flamegraphCanvas}
      flamegraphView={props.flamegraphView}
    >
      <HoveredFrameMainInfo>
        <FrameColorIndicator
          backgroundColor={formatColorForFrame(props.frame, props.flamegraphRenderer)}
        />
        {props.flamegraphRenderer.flamegraph.formatter(props.frame.node.totalWeight)}{' '}
        {formatWeightToProfileDuration(
          props.frame.node,
          props.flamegraphRenderer.flamegraph
        )}{' '}
        {props.frame.frame.name}
      </HoveredFrameMainInfo>
      <HoveredFrameTimelineInfo>
        {props.flamegraphRenderer.flamegraph.timelineFormatter(props.frame.start)}{' '}
        {' \u2014 '}
        {props.flamegraphRenderer.flamegraph.timelineFormatter(props.frame.end)}
      </HoveredFrameTimelineInfo>
    </BoundTooltip>
  );
}

const HoveredFrameTimelineInfo = styled('div')`
  color: ${p => p.theme.subText};
`;

const HoveredFrameMainInfo = styled('div')`
  display: flex;
  align-items: center;
`;

const FrameColorIndicator = styled('div')<{
  backgroundColor: React.CSSProperties['backgroundColor'];
}>`
  width: 12px;
  height: 12px;
  min-width: 12px;
  min-height: 12px;
  border-radius: 2px;
  display: inline-block;
  background-color: ${p => p.backgroundColor};
  margin-right: ${space(1)};
`;
