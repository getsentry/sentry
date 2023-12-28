import {RefObject, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {EChartsOption} from 'echarts';
import moment from 'moment';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {Button} from 'sentry/components/button';
import {IconDelete, IconStack, IconZoom} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EChartBrushEndHandler, ReactEchartsRef} from 'sentry/types/echarts';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import theme from 'sentry/utils/theme';
import useRouter from 'sentry/utils/useRouter';

interface AbsolutePosition {
  height: string;
  left: string;
  top: string;
  width: string;
}

export interface FocusArea {
  datapoints: {
    x: number[];
    y: number[];
  };
  position: AbsolutePosition;
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
  {widgetIndex, isDisabled = false}: UseFocusAreaBrushOptions
) {
  const router = useRouter();

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

      const position = getPosition(brushEnd, chartWidth);

      onAdd({
        widgetIndex,
        position,
        datapoints: {
          x: rect.coordRange[0],
          y: rect.coordRange[1],
        },
      });
    },
    [chartRef, isDisabled, onAdd, widgetIndex]
  );

  const startBrush = useCallback(() => {
    chartRef.current?.getEchartsInstance().dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: {
        brushType: 'rect',
      },
    });
  }, [chartRef]);

  const handleZoomIn = useCallback(() => {
    const startFormatted = getDate(focusArea?.datapoints.x[0]);
    const endFormatted = getDate(focusArea?.datapoints.x[1]);

    updateDateTime(
      {
        period: null,
        start: startFormatted ? getUtcToLocalDateObject(startFormatted) : startFormatted,
        end: endFormatted ? getUtcToLocalDateObject(endFormatted) : endFormatted,
      },
      router,
      {save: true}
    );
    onRemove();
  }, [focusArea, onRemove, router]);

  const renderOverlay = focusArea && focusArea.widgetIndex === widgetIndex;

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
        z: 10,
      } as EChartsOption['brush'],
    };
  }, [onBrushEnd]);

  if (renderOverlay) {
    return {
      overlay: (
        <BrushRectOverlay rect={focusArea} onRemove={onRemove} onZoom={handleZoomIn} />
      ),
      startBrush,
      options: {},
    };
  }

  return {
    overlay: null,
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
        <Button size="xs" disabled icon={<IconStack />}>
          {t('Show samples')}
        </Button>
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
  if (!rect) {
    return {
      left: '0',
      top: '0',
      width: '0',
      height: '0',
    };
  }

  const left = rect.range[0][0];
  const width = rect.range[0][1] - left;

  const leftPercentage = (left / chartWidth) * 100;
  const widthPercentage = (width / chartWidth) * 100;

  const topPx = Math.min(...rect.range[1]);
  const heightPx = Math.max(...rect.range[1]) - topPx;

  return {
    left: `${leftPercentage}%`,
    top: `${topPx}px`,
    width: `${widthPercentage}%`,
    height: `${heightPx}px`,
  };
};

const FocusAreaRectActions = styled('div')<{
  top: string;
}>`
  position: absolute;
  top: ${p => p.top};
  display: flex;
  gap: ${space(0.5)};
  padding: ${space(1)};
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
`;
