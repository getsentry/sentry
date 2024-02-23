import type {RefObject} from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';
import color from 'color';
import type {EChartsOption} from 'echarts';
import isEqual from 'lodash/isEqual';
import moment from 'moment';

import {Button} from 'sentry/components/button';
import {IconClose, IconZoom} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {DateString} from 'sentry/types';
import type {EChartBrushEndHandler, ReactEchartsRef} from 'sentry/types/echarts';
import {getMetricConversionFunction} from 'sentry/utils/metrics/normalizeMetricValue';
import {MAIN_X_AXIS_ID, MAIN_Y_AXIS_ID} from 'sentry/views/ddm/chart/chart';
import type {ValueRect} from 'sentry/views/ddm/chart/chartUtils';
import {getValueRect} from 'sentry/views/ddm/chart/chartUtils';
import type {FocusAreaSelection, SelectionRange} from 'sentry/views/ddm/chart/types';
import {CHART_HEIGHT} from 'sentry/views/ddm/constants';
import type {FocusAreaProps} from 'sentry/views/ddm/context';

import type {DateTimeObject} from '../../../components/charts/utils';

interface AbsolutePosition {
  height: string;
  left: string;
  top: string;
  width: string;
}

interface UseFocusAreaOptions {
  widgetIndex: number;
  isDisabled?: boolean;
  useFullYAxis?: boolean;
}

export interface UseFocusAreaProps extends FocusAreaProps {
  chartRef: RefObject<ReactEchartsRef>;
  opts: UseFocusAreaOptions;
  chartUnit?: string;
  onZoom?: (range: DateTimeObject) => void;
  sampleUnit?: string;
}

type BrushEndResult = Parameters<EChartBrushEndHandler>[0];

export function useFocusArea({
  chartRef,
  selection: selection,
  opts: {widgetIndex, isDisabled, useFullYAxis},
  sampleUnit = 'none',
  chartUnit = 'none',
  onAdd,
  onDraw,
  onRemove,
  onZoom,
}: UseFocusAreaProps) {
  const hasFocusArea = useMemo(
    () => selection && selection.widgetIndex === widgetIndex,
    [selection, widgetIndex]
  );
  const isDrawingRef = useRef(false);

  const theme = useTheme();

  const startBrush = useCallback(() => {
    if (hasFocusArea || isDisabled) {
      return;
    }
    onDraw?.();

    chartRef.current?.getEchartsInstance().dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: {
        brushType: 'rect',
      },
    });
  }, [chartRef, hasFocusArea, isDisabled, onDraw]);

  useEffect(() => {
    const chartElement = chartRef.current?.ele;
    const handleMouseDown = () => {
      isDrawingRef.current = true;
      startBrush();
    };

    // Handle mouse up is called after onBrushEnd
    // We can use it for a final reliable cleanup as onBrushEnd is not always called (e.g. when simply clicking the chart)
    const handleMouseUp = () => {
      isDrawingRef.current = false;
    };

    chartElement?.addEventListener('mousedown', handleMouseDown, {capture: true});
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      chartElement?.removeEventListener('mousedown', handleMouseDown, {capture: true});
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [chartRef, startBrush]);

  const onBrushEnd = useCallback(
    (brushEnd: BrushEndResult) => {
      if (isDisabled || !isDrawingRef.current) {
        return;
      }
      const rect = brushEnd.areas[0];
      if (!rect) {
        return;
      }

      const valueConverter = getMetricConversionFunction(chartUnit, sampleUnit);

      const range = getSelectionRange(
        brushEnd,
        !!useFullYAxis,
        getValueRect(chartRef),
        valueConverter
      );
      onAdd?.({
        widgetIndex,
        range,
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
    [isDisabled, sampleUnit, chartUnit, useFullYAxis, chartRef, onAdd, widgetIndex]
  );

  const handleRemove = useCallback(() => {
    onRemove?.();
  }, [onRemove]);

  const handleZoomIn = useCallback(() => {
    handleRemove();
    onZoom?.({
      period: null,
      ...selection?.range,
    });
  }, [selection, handleRemove, onZoom]);

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
          rect={selection!}
          onRemove={handleRemove}
          onZoom={handleZoomIn}
          chartRef={chartRef}
          useFullYAxis={!!useFullYAxis}
          sampleUnit={sampleUnit}
          chartUnit={chartUnit}
        />
      ),
      isDrawingRef,
      options: {},
    };
  }

  return {
    overlay: null,
    isDrawingRef,
    options: brushOptions,
  };
}

type BrushRectOverlayProps = {
  chartRef: RefObject<ReactEchartsRef>;
  chartUnit: string;
  onRemove: () => void;
  onZoom: () => void;
  rect: FocusAreaSelection | null;
  sampleUnit: string;
  useFullYAxis: boolean;
};

function BrushRectOverlay({
  rect,
  onZoom,
  onRemove,
  useFullYAxis,
  chartRef,
  sampleUnit,
  chartUnit,
}: BrushRectOverlayProps) {
  const [position, setPosition] = useState<AbsolutePosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useResizeObserver({
    ref: wrapperRef,
    onResize: () => {
      const chartInstance = chartRef.current?.getEchartsInstance();
      chartInstance?.resize();
      updatePosition();
    },
  });

  const updatePosition = useCallback(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (
      !rect ||
      !chartInstance ||
      rect.range.max === undefined ||
      rect.range.min === undefined ||
      rect.range.start === undefined ||
      rect.range.end === undefined
    ) {
      return;
    }
    const finder = {xAxisId: MAIN_X_AXIS_ID, yAxisId: MAIN_Y_AXIS_ID};

    const valueConverter = getMetricConversionFunction(sampleUnit, chartUnit);
    const max = valueConverter(rect.range.max);
    const min = valueConverter(rect.range.min);

    const topLeft = chartInstance.convertToPixel(finder, [
      getTimestamp(rect.range.start),
      max,
    ]);
    const bottomRight = chartInstance.convertToPixel(finder, [
      getTimestamp(rect.range.end),
      min,
    ] as number[]);

    if (!topLeft || !bottomRight) {
      return;
    }

    const widthPx = bottomRight[0] - topLeft[0];
    const heightPx = bottomRight[1] - topLeft[1];

    const resultTop = useFullYAxis ? '0px' : `${topLeft[1].toPrecision(5)}px`;
    const resultHeight = useFullYAxis
      ? `${CHART_HEIGHT}px`
      : `${heightPx.toPrecision(5)}px`;

    // Ensure the focus area rect is always within the chart bounds
    const left = Math.max(topLeft[0], 0);
    const width = Math.min(widthPx, chartInstance.getWidth() - left);

    const newPosition = {
      left: `${left.toPrecision(5)}px`,
      top: resultTop,
      width: `${width.toPrecision(5)}px`,
      height: resultHeight,
    };

    if (!isEqual(newPosition, position)) {
      setPosition(newPosition);
    }
  }, [chartRef, rect, sampleUnit, chartUnit, useFullYAxis, position]);

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

const getDateString = (timestamp: number): string =>
  moment.utc(timestamp).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
const getTimestamp = (date: DateString) => moment.utc(date).valueOf();

const getSelectionRange = (
  params: BrushEndResult,
  useFullYAxis: boolean,
  boundingRect: ValueRect,
  valueConverter: (value: number) => number
): SelectionRange => {
  const rect = params.areas[0];

  const startTimestamp = Math.min(...rect.coordRange[0]);
  const endTimestamp = Math.max(...rect.coordRange[0]);

  const startDate = getDateString(Math.max(startTimestamp, boundingRect.xMin));
  const endDate = getDateString(Math.min(endTimestamp, boundingRect.xMax));

  const min = useFullYAxis ? NaN : valueConverter(Math.min(...rect.coordRange[1]));
  const max = useFullYAxis ? NaN : valueConverter(Math.max(...rect.coordRange[1]));

  return {
    start: startDate,
    end: endDate,
    min,
    max,
  };
};

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

  border: 2px solid ${p => p.theme.gray500};
  border-radius: ${p => p.theme.borderRadius};

  /* requires overflow: hidden on FocusAreaWrapper */
  box-shadow: 0px 0px 0px 9999px ${p => color(p.theme.surface400).alpha(0.75).toString()};
`;
