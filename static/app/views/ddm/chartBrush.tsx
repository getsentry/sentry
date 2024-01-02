import {RefObject, useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {EChartsOption} from 'echarts';
import moment from 'moment';

import {Button} from 'sentry/components/button';
import {IconDelete, IconZoom} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {EChartBrushEndHandler, ReactEchartsRef} from 'sentry/types/echarts';
import {MetricRange} from 'sentry/utils/metrics';
import theme from 'sentry/utils/theme';

import {DateTimeObject} from '../../components/charts/utils';

interface AbsolutePosition {
  height: string;
  left: string;
  top: string;
  width: string;
}

export interface FocusArea {
  position: AbsolutePosition;
  range: MetricRange;
  widgetIndex: number;
}

interface UseFocusAreaBrushOptions {
  widgetIndex: number;
  isDisabled?: boolean;
}

type BrushEndResult = Parameters<EChartBrushEndHandler>[0];

export function useFocusAreaBrush(
  chartRef: RefObject<ReactEchartsRef>,
  focusArea: FocusArea | null,
  onAdd: (area: FocusArea) => void,
  onRemove: () => void,
  onZoom: (range: DateTimeObject) => void,
  {widgetIndex, isDisabled = false}: UseFocusAreaBrushOptions
) {
  const hasFocusArea = useMemo(
    () => focusArea && focusArea.widgetIndex === widgetIndex,
    [focusArea, widgetIndex]
  );

  const isDrawingRef = useRef(false);

  const onBrushEnd = useCallback(
    (brushEnd: BrushEndResult) => {
      if (isDisabled) {
        return;
      }

      const rect = brushEnd.areas[0];
      if (!rect) {
        return;
      }

      const chartWidth = chartRef.current?.getEchartsInstance().getWidth() ?? 100;

      onAdd({
        widgetIndex,
        position: getPosition(brushEnd, chartWidth),
        range: getMetricRange(brushEnd),
      });

      // Remove brush from echarts immediately after adding the focus area
      // since brushes get added to all charts in the group by default and then randomly
      // render in the wrong place
      chartRef.current?.getEchartsInstance().dispatchAction({
        type: 'brush',
        brushType: 'clear',
        areas: [],
      });
      isDrawingRef.current = false;
    },
    [chartRef, isDisabled, onAdd, widgetIndex]
  );

  const startBrush = useCallback(() => {
    if (hasFocusArea) {
      return;
    }

    chartRef.current?.getEchartsInstance().dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: {
        brushType: 'rect',
      },
    });
    isDrawingRef.current = true;
  }, [chartRef, hasFocusArea]);

  const handleRemove = useCallback(() => {
    onRemove();
  }, [onRemove]);

  const handleZoomIn = useCallback(() => {
    onZoom({
      period: null,
      ...focusArea?.range,
    });
    handleRemove();
  }, [focusArea, handleRemove, onZoom]);

  const brushOptions = useMemo(() => {
    return {
      onBrushEnd,
      toolBox: {
        show: false,
      },
      brush: {
        toolbox: ['rect'],
        xAxisIndex: 0,
        brushStyle: {
          borderWidth: 2,
          borderColor: theme.purple300,
          color: 'transparent',
        },
        inBrush: {
          opacity: 1,
        },
        outOfBrush: {
          opacity: 1,
        },
        z: 10,
      } as EChartsOption['brush'],
    };
  }, [onBrushEnd]);

  if (hasFocusArea) {
    return {
      overlay: (
        <BrushRectOverlay
          rect={focusArea}
          onRemove={handleRemove}
          onZoom={handleZoomIn}
        />
      ),
      isDrawingRef,
      startBrush,
      options: {},
    };
  }

  return {
    overlay: null,
    isDrawingRef,

    startBrush,
    options: brushOptions,
  };
}

function BrushRectOverlay({rect, onZoom, onRemove}) {
  if (!rect) {
    return null;
  }

  const {top, left, width, height} = rect.position;

  return (
    <FocusAreaRect top={top} left={left} width={width} height={height}>
      <FocusAreaRectActions top={height}>
        <Button
          size="xs"
          onClick={onZoom}
          icon={<IconZoom isZoomIn />}
          aria-label="zoom"
        />
        <Button size="xs" onClick={onRemove} icon={<IconDelete />} aria-label="remove" />
      </FocusAreaRectActions>
    </FocusAreaRect>
  );
}

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

const getPosition = (params: BrushEndResult, chartWidth: number): AbsolutePosition => {
  const rect = params.areas[0];

  const left = rect.range[0][0];
  const width = rect.range[0][1] - left;

  const leftPercentage = (left / chartWidth) * 100;
  const widthPercentage = (width / chartWidth) * 100;

  const topPx = Math.min(...rect.range[1]);
  const heightPx = Math.max(...rect.range[1]) - topPx;

  return {
    left: `${leftPercentage.toPrecision(3)}%`,
    top: `${topPx}px`,
    width: `${widthPercentage.toPrecision(3)}%`,
    height: `${heightPx}px`,
  };
};

const getMetricRange = (params: BrushEndResult): MetricRange => {
  const rect = params.areas[0];

  const startTimestamp = Math.min(...rect.coordRange[0]);
  const endTimestamp = Math.max(...rect.coordRange[0]);

  const startDate = getDate(startTimestamp);
  const endDate = getDate(endTimestamp);

  const min = Math.min(...rect.coordRange[1]);
  const max = Math.max(...rect.coordRange[1]);

  return {
    start: startDate,
    end: endDate,
    min,
    max,
  };
};

const FocusAreaRectActions = styled('div')<{
  top: string;
}>`
  position: absolute;
  top: ${p => p.top};
  display: flex;
  left: 0;
  gap: ${space(0.5)};
  padding: ${space(0.5)};
  z-index: 2;
  pointer-events: auto;
`;

const FocusAreaRect = styled('div')<{
  height: string;
  left: string;
  top: string;
  width: string;
}>`
  position: absolute;
  top: ${p => p.top};
  left: ${p => p.left};
  width: ${p => p.width};
  height: ${p => p.height};
  outline: 2px solid ${p => p.theme.purple300};
  outline-offset: -1px;
  padding: ${space(1)};
  pointer-events: none;
  z-index: 1;
`;
