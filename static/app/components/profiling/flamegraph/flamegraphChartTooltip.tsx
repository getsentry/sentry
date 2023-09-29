import {useMemo} from 'react';
import * as React from 'react';
import {vec2} from 'gl-matrix';

import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {t} from 'sentry/locale';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import {FlamegraphChartRenderer} from 'sentry/utils/profiling/renderers/chartRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

import {
  FlamegraphTooltipColorIndicator,
  FlamegraphTooltipFrameMainInfo,
  FlamegraphTooltipTimelineInfo,
} from './flamegraphTooltip';

export interface FlamegraphChartTooltipProps {
  canvasBounds: Rect;
  chart: FlamegraphChart;
  chartCanvas: FlamegraphCanvas;
  chartRenderer: FlamegraphChartRenderer;
  chartView: CanvasView<FlamegraphChart>;
  configSpaceCursor: vec2;
}

export function FlamegraphChartTooltip({
  canvasBounds,
  configSpaceCursor,
  chartCanvas,
  chart,
  chartRenderer,
  chartView,
}: // chartRenderer,
FlamegraphChartTooltipProps) {
  const series = useMemo(() => {
    return chartRenderer.findHoveredSeries(configSpaceCursor, 6e7);
  }, [chartRenderer, configSpaceCursor]);

  return series.length > 0 ? (
    <BoundTooltip
      bounds={canvasBounds}
      cursor={configSpaceCursor}
      canvas={chartCanvas}
      canvasView={chartView}
    >
      {series.map((p, i) => {
        return (
          <React.Fragment key={i}>
            <FlamegraphTooltipFrameMainInfo>
              <FlamegraphTooltipColorIndicator
                backgroundColor={p.fillColor || p.lineColor}
              />
              {p.name}:&nbsp;
              <FlamegraphTooltipTimelineInfo>
                {chart.tooltipFormatter(p.points[0].y)}
              </FlamegraphTooltipTimelineInfo>
            </FlamegraphTooltipFrameMainInfo>
          </React.Fragment>
        );
      })}
      <FlamegraphTooltipTimelineInfo>
        {t('at')}{' '}
        {chart.timelineFormatter(
          configSpaceCursor[0] + chartView.configSpaceTransform[6]
        )}{' '}
      </FlamegraphTooltipTimelineInfo>
    </BoundTooltip>
  ) : null;
}
