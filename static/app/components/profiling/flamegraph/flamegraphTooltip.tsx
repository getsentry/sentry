import {Fragment} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {formatColorForFrame, Rect} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

import {BoundTooltip} from '../boundTooltip';

export function formatWeightToProfileDuration(
  frame: CallTreeNode,
  flamegraph: Flamegraph
) {
  return `(${Math.round((frame.totalWeight / flamegraph.profile.duration) * 100)}%)`;
}

function formatFileNameAndLineColumn(frame: FlamegraphFrame): string | null {
  if (!frame.frame.file) {
    return '<unknown file>';
  }
  if (typeof frame.frame.line === 'number' && typeof frame.frame.column === 'number') {
    return `${frame.frame.file}:${frame.frame.line}:${frame.frame.column}`;
  }
  if (typeof frame.frame.line === 'number') {
    return `${frame.frame.file}:${frame.frame.line}`;
  }
  return `${frame.frame.file}:<unknown line>`;
}

export interface FlamegraphTooltipProps {
  canvasBounds: Rect;
  configSpaceCursor: vec2;
  flamegraphCanvas: FlamegraphCanvas;
  flamegraphRenderer: FlamegraphRenderer;
  flamegraphView: FlamegraphView;
  frame: FlamegraphFrame;
  platform: 'javascript' | 'python' | 'ios' | 'android' | string | undefined;
}

export function FlamegraphTooltip(props: FlamegraphTooltipProps) {
  return (
    <BoundTooltip
      bounds={props.canvasBounds}
      cursor={props.configSpaceCursor}
      flamegraphCanvas={props.flamegraphCanvas}
      flamegraphView={props.flamegraphView}
    >
      <Fragment>
        <FlamegraphTooltipFrameMainInfo>
          <FlamegraphTooltipColorIndicator
            backgroundColor={formatColorForFrame(props.frame, props.flamegraphRenderer)}
          />
          {props.flamegraphRenderer.flamegraph.formatter(props.frame.node.totalWeight)}{' '}
          {formatWeightToProfileDuration(
            props.frame.node,
            props.flamegraphRenderer.flamegraph
          )}{' '}
          {props.frame.frame.name}
        </FlamegraphTooltipFrameMainInfo>
        <FlamegraphTooltipTimelineInfo>
          {defined(props.frame.frame.file) && (
            <Fragment>
              {t('source')}:{formatFileNameAndLineColumn(props.frame)}
            </Fragment>
          )}
        </FlamegraphTooltipTimelineInfo>
        <FlamegraphTooltipTimelineInfo>
          {props.flamegraphRenderer.flamegraph.timelineFormatter(props.frame.start)}{' '}
          {' \u2014 '}
          {props.flamegraphRenderer.flamegraph.timelineFormatter(props.frame.end)}
          {props.frame.frame.inline ? (
            <FlamegraphInlineIndicator>
              <IconLightning width={10} />
              {t('inline frame')}
            </FlamegraphInlineIndicator>
          ) : (
            ''
          )}
        </FlamegraphTooltipTimelineInfo>
      </Fragment>
    </BoundTooltip>
  );
}

const FlamegraphInlineIndicator = styled('span')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.25)} ${space(0.25)};
  line-height: 12px;
  margin: 0 ${space(0.5)};
  align-self: flex-end;

  svg {
    width: 10px;
    height: 10px;
    transform: translateY(1px);
  }
`;

export const FlamegraphTooltipTimelineInfo = styled('div')`
  color: ${p => p.theme.subText};
`;

export const FlamegraphTooltipFrameMainInfo = styled('div')`
  display: flex;
  align-items: center;
`;

export const FlamegraphTooltipColorIndicator = styled('div')<{
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
