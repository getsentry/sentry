import {useMemo} from 'react';
import * as React from 'react';
import {vec2} from 'gl-matrix';

import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
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

export interface FlamegraphCpuChartTooltipProps {
  canvasBounds: Rect;
  configSpaceCursor: vec2;
  cpuChart: FlamegraphChart;
  cpuChartCanvas: FlamegraphCanvas;
  cpuChartRenderer: FlamegraphChartRenderer;
  cpuChartView: CanvasView<FlamegraphChart>;
}

export function FlamegraphCpuChartTooltip({
  canvasBounds,
  configSpaceCursor,
  cpuChartCanvas,
  cpuChart,
  cpuChartRenderer,
  cpuChartView,
}: // cpuChartRenderer,
FlamegraphCpuChartTooltipProps) {
  const series = useMemo(() => {
    return cpuChartRenderer.findHoveredSeries(configSpaceCursor, 6e7);
  }, [cpuChartRenderer, configSpaceCursor]);

  return series.length > 0 ? (
    <BoundTooltip
      bounds={canvasBounds}
      cursor={configSpaceCursor}
      canvas={cpuChartCanvas}
      canvasView={cpuChartView}
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
                {cpuChart.tooltipFormatter(p.points[0].y)}
              </FlamegraphTooltipTimelineInfo>
            </FlamegraphTooltipFrameMainInfo>
          </React.Fragment>
        );
      })}
    </BoundTooltip>
  ) : null;
}
