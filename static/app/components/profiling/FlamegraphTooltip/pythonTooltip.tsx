import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {formatColorForFrame} from 'sentry/utils/profiling/gl/utils';

import {
  FlamegraphTooltipColorIndicator,
  FlamegraphTooltipFrameMainInfo,
  FlamegraphTooltipProps,
  FlamegraphTooltipTimelineInfo,
  formatWeightToProfileDuration,
} from './flamegraphTooltip';

export function PythonTooltip(props: FlamegraphTooltipProps) {
  return (
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
        {props.frame.frame.file ?? t('<unknown file>')}:
        {props.frame.frame.line ?? t('<unknown line>')}
      </FlamegraphTooltipTimelineInfo>
      <FlamegraphTooltipTimelineInfo>
        {props.flamegraphRenderer.flamegraph.timelineFormatter(props.frame.start)}{' '}
        {' \u2014 '}
        {props.flamegraphRenderer.flamegraph.timelineFormatter(props.frame.end)}
      </FlamegraphTooltipTimelineInfo>
    </Fragment>
  );
}
