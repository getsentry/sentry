import {
  Fragment,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';
import color from 'color';
import {EChartsOption} from 'echarts';
import moment from 'moment';

import {Button} from 'sentry/components/button';
import {IconClose, IconZoom} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {EChartBrushEndHandler, ReactEchartsRef} from 'sentry/types/echarts';
import {MetricRange} from 'sentry/utils/metrics';

import {DateTimeObject} from '../../components/charts/utils';

interface AbsolutePosition {
  height: string;
  left: string;
  top: string;
  width: string;
}

export interface FocusArea {
  range: MetricRange;
  widgetIndex: number;
}

interface UseFocusAreaBrushOptions {
  widgetIndex: number;
  isDisabled?: boolean;
  useFullYAxis?: boolean;
}

type BrushEndResult = Parameters<EChartBrushEndHandler>[0];

export function useFocusAreaBrush(
  chartRef: RefObject<ReactEchartsRef>,
  focusArea: FocusArea | null,
  {widgetIndex, isDisabled = false, useFullYAxis = false}: UseFocusAreaBrushOptions,
  onAdd: (area: FocusArea) => void = () => {},
  onRemove: () => void = () => {},
  onZoom: (range: DateTimeObject) => void = () => {}
) {
  const isHoveredRef = useRef(false);
  const hasFocusArea = useMemo(
    () => focusArea && focusArea.widgetIndex === widgetIndex,
    [focusArea, widgetIndex]
  );

  const isDrawingRef = useRef(false);

  const theme = useTheme();

  const chartElement = chartRef.current?.ele;
  useEffect(() => {
    if (!chartElement) {
      return () => {};
    }

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
    };
    const handleMouseLeave = () => {
      isHoveredRef.current = false;
    };

    chartElement.addEventListener('mouseenter', handleMouseEnter);
    chartElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      chartElement.removeEventListener('mouseenter', handleMouseEnter);
      chartElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [chartElement]);

  const onBrushEnd = useCallback(
    (brushEnd: BrushEndResult) => {
      if (isDisabled || !isHoveredRef.current) {
        return;
      }

      const rect = brushEnd.areas[0];
      if (!rect) {
        return;
      }

      onAdd({
        widgetIndex,
        range: getMetricRange(brushEnd, useFullYAxis),
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
    [chartRef, isDisabled, onAdd, widgetIndex, useFullYAxis]
  );

  const startBrush = useCallback(() => {
    if (hasFocusArea || isDisabled || !isHoveredRef.current) {
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
  }, [chartRef, hasFocusArea, isDisabled]);

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
          borderColor: theme.gray500,
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
  }, [onBrushEnd, theme.gray500]);

  if (hasFocusArea) {
    return {
      overlay: (
        <BrushRectOverlay
          rect={focusArea}
          onRemove={handleRemove}
          onZoom={handleZoomIn}
          chartRef={chartRef}
          useFullYAxis={useFullYAxis}
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

type BrushRectOverlayProps = {
  chartRef: RefObject<ReactEchartsRef>;
  onRemove: () => void;
  onZoom: () => void;
  rect: FocusArea | null;
  useFullYAxis: boolean;
};

function BrushRectOverlay({
  rect,
  onZoom,
  onRemove,
  useFullYAxis,
  chartRef,
}: BrushRectOverlayProps) {
  const chartInstance = chartRef.current?.getEchartsInstance();
  const [position, setPosition] = useState<AbsolutePosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useResizeObserver({
    ref: wrapperRef,
    onResize: () => {
      chartInstance?.resize();
      updatePosition();
    },
  });

  const updatePosition = useCallback(() => {
    if (!rect || !chartInstance) {
      return;
    }

    const finder = {xAxisId: 'xAxis', yAxisId: 'yAxis'};

    const topLeft = chartInstance.convertToPixel(finder, [
      getTimestamp(rect.range.start),
      rect.range.max,
    ] as number[]);
    const bottomRight = chartInstance.convertToPixel(finder, [
      getTimestamp(rect.range.end),
      rect.range.min,
    ] as number[]);

    if (!topLeft || !bottomRight) {
      return;
    }

    const widthPx = bottomRight[0] - topLeft[0];
    const heightPx = bottomRight[1] - topLeft[1];

    const resultTop = useFullYAxis ? '0' : `${topLeft[1].toPrecision(5)}px`;
    const resultHeight = useFullYAxis
      ? `${CHART_HEIGHT}px`
      : `${heightPx.toPrecision(5)}px`;

    // Ensure the focus area rect is always within the chart bounds
    const left = Math.max(topLeft[0], 0);
    const width = Math.min(widthPx, chartInstance.getWidth() - left);

    setPosition({
      left: `${left.toPrecision(5)}px`,
      top: resultTop,
      width: `${width.toPrecision(5)}px`,
      height: resultHeight,
    });
  }, [rect, chartInstance, useFullYAxis]);

  useEffect(() => {
    updatePosition();
  }, [rect, updatePosition]);

  if (!position) {
    return null;
  }

  const {left, top, width, height} = position;

  return (
    <Fragment>
      <FocusAreaWrapper ref={wrapperRef}>
        <FocusAreaRect top={top} left={left} width={width} height={height} />
      </FocusAreaWrapper>
      <FocusAreaRectActions top={top} rectHeight={height} left={left}>
        <Button
          size="xs"
          onClick={onZoom}
          icon={<IconZoom isZoomIn />}
          aria-label="zoom"
        />
        <Button size="xs" onClick={onRemove} icon={<IconClose />} aria-label="remove" />
      </FocusAreaRectActions>
    </Fragment>
  );
}

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

const getTimestamp = date => (date ? moment.utc(date).valueOf() : null);

const getMetricRange = (params: BrushEndResult, useFullYAxis: boolean): MetricRange => {
  const rect = params.areas[0];

  const startTimestamp = Math.min(...rect.coordRange[0]);
  const endTimestamp = Math.max(...rect.coordRange[0]);

  const startDate = getDate(startTimestamp);
  const endDate = getDate(endTimestamp);

  const min = useFullYAxis ? NaN : Math.min(...rect.coordRange[1]);
  const max = useFullYAxis ? NaN : Math.max(...rect.coordRange[1]);

  return {
    start: startDate,
    end: endDate,
    min,
    max,
  };
};

const CHART_HEIGHT = 275;

const FocusAreaRectActions = styled('div')<{
  left: string;
  rectHeight: string;
  top: string;
}>`
  position: absolute;
  top: calc(${p => p.top} + ${p => p.rectHeight});
  left: ${p => p.left};
  display: flex;
  gap: ${space(0.5)};
  padding: ${space(0.5)};
  z-index: 2;
  pointer-events: auto;
`;

const FocusAreaWrapper = styled('div')`
  position: absolute;
  top: 0px;
  left: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
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

  padding: ${space(1)};
  pointer-events: none;
  z-index: 1;

  outline: 2px solid ${p => p.theme.gray500};
  outline-style: auto;

  /* requires overflow: hidden on FocusAreaWrapper */
  box-shadow: 0px 0px 0px 9999px ${p => color(p.theme.surface400).alpha(0.75).toString()};
`;
