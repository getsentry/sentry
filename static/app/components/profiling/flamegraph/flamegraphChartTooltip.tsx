import {useMemo} from 'react';
import * as React from 'react';
import type {vec2} from 'gl-matrix';

import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {t} from 'sentry/locale';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import type {FlamegraphChartRenderer} from 'sentry/utils/profiling/renderers/chartRenderer';
import type {Rect} from 'sentry/utils/profiling/speedscope';
import {formatTo, type ProfilingFormatterUnit} from 'sentry/utils/profiling/units/units';

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
  configViewUnit: ProfilingFormatterUnit;
}

export function FlamegraphChartTooltip({
  canvasBounds,
  configSpaceCursor,
  chartCanvas,
  chart,
  chartRenderer,
  chartView,
  configViewUnit,
}: FlamegraphChartTooltipProps) {
  const series = useMemo(() => {
    return chartRenderer.findHoveredSeries(
      configSpaceCursor,
      formatTo(100, 'milliseconds', configViewUnit)
    );
  }, [chartRenderer, configSpaceCursor, configViewUnit]);

  return series.length > 0 ? (
    <BoundTooltip
      cursor={configSpaceCursor}
      canvas={chartCanvas}
      canvasBounds={canvasBounds}
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
                {chart.tooltipFormatter(p.points[0]!.y)}
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
