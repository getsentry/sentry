import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {vec2} from 'gl-matrix';

import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import type {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import type {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {formatColorForFrame} from 'sentry/utils/profiling/gl/utils';
import type {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {relativeChange} from 'sentry/utils/profiling/units/units';

export const PROFILING_SAMPLES_FORMATTER = Intl.NumberFormat(undefined, {
  notation: 'compact',
});

export function formatWeightToProfileDuration(
  frame: CallTreeNode,
  flamegraph: Flamegraph
) {
  const weight = (frame.totalWeight / flamegraph.profile.duration) * 100;

  return `${Math.round(weight * 100) / 100}%`;
}

export interface FlamegraphTooltipProps {
  canvasBounds: Rect;
  configSpaceCursor: vec2;
  flamegraph: Flamegraph | DifferentialFlamegraph;
  flamegraphCanvas: FlamegraphCanvas;
  flamegraphRenderer: FlamegraphRenderer;
  flamegraphView: CanvasView<Flamegraph>;
  frame: FlamegraphFrame;
  platform: 'javascript' | 'python' | 'ios' | 'android' | string | undefined;
  disableColorCoding?: boolean;
}

function isDifferentiableFlamegraph(
  flamegraph: Flamegraph | DifferentialFlamegraph
): flamegraph is DifferentialFlamegraph {
  return 'isDifferentialFlamegraph' in flamegraph && flamegraph.isDifferentialFlamegraph;
}

export function FlamegraphTooltip(props: FlamegraphTooltipProps) {
  const frameInConfigSpace = useMemo<Rect>(() => {
    return new Rect(
      props.frame.start,
      props.frame.end,
      props.frame.end - props.frame.start,
      1
    ).transformRect(props.flamegraphView.configSpaceTransform);
  }, [props.flamegraphView, props.frame]);

  if (
    props.flamegraphRenderer.flamegraph.profile.unit === 'count' &&
    !isDifferentiableFlamegraph(props.flamegraph)
  ) {
    return (
      <AggregateFlamegraphTooltip {...props} frameInConfigSpace={frameInConfigSpace} />
    );
  }

  if (isDifferentiableFlamegraph(props.flamegraph)) {
    return (
      <DifferentialFlamegraphTooltip
        {...props}
        flamegraph={props.flamegraph}
        frameInConfigSpace={frameInConfigSpace}
      />
    );
  }

  return <FlamechartTooltip {...props} frameInConfigSpace={frameInConfigSpace} />;
}

interface DifferentialFlamegraphTooltipProps extends FlamegraphTooltipProps {
  flamegraph: DifferentialFlamegraph;
  frameInConfigSpace: Rect;
}
function DifferentialFlamegraphTooltip(props: DifferentialFlamegraphTooltipProps) {
  const flamegraph = props.flamegraph;
  const count = useMemo(() => {
    return props.flamegraph.weights.get(props.frame.node);
  }, [props.frame, props.flamegraph]);

  // A change can only happen if a frame was present in previous and current profiles
  const shouldShowChange = !!count;
  const relative = shouldShowChange ? relativeChange(count.after, count.before) : 0;

  const formattedChange = shouldShowChange
    ? relative === 0
      ? t('no change')
      : `${relative > 0 ? '+' : ''}${formatPercentage(relative)}`
    : props.flamegraph.negated
      ? t('removed function')
      : t(`new function`);

  return (
    <BoundTooltip
      cursor={props.configSpaceCursor}
      canvas={props.flamegraphCanvas}
      canvasBounds={props.canvasBounds}
      canvasView={props.flamegraphView}
    >
      <FlamegraphTooltipFrameMainInfo>
        <FlamegraphTooltipColorIndicator
          backgroundColor={formatColorForFrame(props.frame, props.flamegraphRenderer)}
        />
        {PROFILING_SAMPLES_FORMATTER.format(props.frame.node.totalWeight)}{' '}
        {t('samples, ') + formattedChange}{' '}
        {`(${formatWeightToProfileDuration(props.frame.node, flamegraph)})`}{' '}
        {props.frame.frame.name}
      </FlamegraphTooltipFrameMainInfo>
      <FlamegraphTooltipTimelineInfo>
        {defined(props.frame.frame.file) && (
          <Fragment>
            {t('source')}:{props.frame.frame.getSourceLocation()}
          </Fragment>
        )}
        <FlamegraphTooltipTimelineInfo>
          {props.frame.frame.is_application ? t('application frame') : t('system frame')}
        </FlamegraphTooltipTimelineInfo>
      </FlamegraphTooltipTimelineInfo>
    </BoundTooltip>
  );
}

interface AggregateFlamegraphTooltipProps extends FlamegraphTooltipProps {
  frameInConfigSpace: Rect;
}
function AggregateFlamegraphTooltip(props: AggregateFlamegraphTooltipProps) {
  return (
    <BoundTooltip
      canvasBounds={props.canvasBounds}
      cursor={props.configSpaceCursor}
      canvas={props.flamegraphCanvas}
      canvasView={props.flamegraphView}
    >
      <FlamegraphTooltipFrameMainInfo>
        <FlamegraphTooltipColorIndicator
          backgroundColor={formatColorForFrame(props.frame, props.flamegraphRenderer)}
        />
        {PROFILING_SAMPLES_FORMATTER.format(props.frame.node.totalWeight)}{' '}
        {t('samples') + ' '}
        {`(${formatWeightToProfileDuration(
          props.frame.node,
          props.flamegraphRenderer.flamegraph
        )})`}{' '}
        {props.frame.frame.name}
      </FlamegraphTooltipFrameMainInfo>
      <FlamegraphTooltipTimelineInfo>
        {t('source')}:{props.frame.frame.getSourceLocation()}
        <FlamegraphTooltipTimelineInfo>
          {props.frame.frame.is_application ? t('application frame') : t('system frame')}
        </FlamegraphTooltipTimelineInfo>
      </FlamegraphTooltipTimelineInfo>
    </BoundTooltip>
  );
}

interface FlamechartTooltipProps extends FlamegraphTooltipProps {
  frameInConfigSpace: Rect;
}
function FlamechartTooltip(props: FlamechartTooltipProps) {
  return (
    <BoundTooltip
      canvasBounds={props.canvasBounds}
      cursor={props.configSpaceCursor}
      canvas={props.flamegraphCanvas}
      canvasView={props.flamegraphView}
    >
      <FlamegraphTooltipFrameMainInfo>
        <FlamegraphTooltipColorIndicator
          backgroundColor={formatColorForFrame(props.frame, props.flamegraphRenderer)}
        />
        {props.flamegraphRenderer.flamegraph.formatter(props.frame.node.totalWeight)}{' '}
        {`(${formatWeightToProfileDuration(
          props.frame.node,
          props.flamegraphRenderer.flamegraph
        )})`}{' '}
        {props.frame.frame.name}
      </FlamegraphTooltipFrameMainInfo>
      <FlamegraphTooltipTimelineInfo>
        {t('source')}:{props.frame.frame.getSourceLocation()}
        <FlamegraphTooltipTimelineInfo>
          {props.frame.frame.is_application ? t('application frame') : t('system frame')}
        </FlamegraphTooltipTimelineInfo>
      </FlamegraphTooltipTimelineInfo>
      <FlamegraphTooltipTimelineInfo>
        {props.flamegraphRenderer.flamegraph.timelineFormatter(
          props.frameInConfigSpace.left
        )}{' '}
        {' \u2014 '}
        {props.flamegraphRenderer.flamegraph.timelineFormatter(
          props.frameInConfigSpace.right
        )}
        {props.frame.frame.inline ? (
          <FlamegraphInlineIndicator>
            <IconLightning width={10} />
            {t('inline frame')}
          </FlamegraphInlineIndicator>
        ) : (
          ''
        )}
      </FlamegraphTooltipTimelineInfo>
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
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const FlamegraphTooltipColorIndicator = styled('div')<{
  backgroundColor: React.CSSProperties['backgroundColor'];
  backgroundImage?: React.CSSProperties['backgroundImage'];
}>`
  width: 12px;
  height: 12px;
  min-width: 12px;
  min-height: 12px;
  border-radius: 2px;
  display: inline-block;
  background-image: ${p => p.backgroundImage};
  background-size: 16px 16px;
  background-color: ${p => p.backgroundColor};
  margin-right: ${space(1)};
  transform: translateY(2px);
`;
