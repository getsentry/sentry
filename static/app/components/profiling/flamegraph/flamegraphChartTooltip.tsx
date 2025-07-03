import {useMemo} from 'react';
import * as React from 'react';
import type {vec2} from 'gl-matrix';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import type {FlamegraphChartRenderer} from 'sentry/utils/profiling/renderers/chartRenderer';
import {formatTo, type ProfilingFormatterUnit} from 'sentry/utils/profiling/units/units';

import {FlamegraphTooltipColorIndicator} from './flamegraphTooltip';

interface FlamegraphChartTooltipProps {
  chart: FlamegraphChart;
  chartCanvas: FlamegraphCanvas;
  chartRenderer: FlamegraphChartRenderer;
  chartView: CanvasView<FlamegraphChart>;
  configSpaceCursor: vec2;
  configViewUnit: ProfilingFormatterUnit;
}

export function FlamegraphChartTooltip({
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
    <BoundTooltip cursor={configSpaceCursor} canvas={chartCanvas} canvasView={chartView}>
      {series.map((p, i) => {
        return (
          <React.Fragment key={i}>
            <Flex align="center" gap={space(1)}>
              <FlamegraphTooltipColorIndicator
                backgroundColor={p.fillColor || p.lineColor}
              />
              {p.name}:&nbsp;
              <Text variant="muted" ellipsis>
                {chart.tooltipFormatter(p.points[0]!.y)}
              </Text>
            </Flex>
          </React.Fragment>
        );
      })}
      <Text variant="muted" ellipsis>
        {t('at')}{' '}
        {chart.timelineFormatter(
          configSpaceCursor[0] + chartView.configSpaceTransform[6]
        )}{' '}
      </Text>
    </BoundTooltip>
  ) : null;
}
