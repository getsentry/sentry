import {RefObject, useCallback} from 'react';
import styled from '@emotion/styled';
import {EChartsOption} from 'echarts';
import moment from 'moment';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ReactEchartsRef} from 'sentry/types/echarts';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import theme from 'sentry/utils/theme';
import useRouter from 'sentry/utils/useRouter';
import {useDDMContext} from 'sentry/views/ddm/context';

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

export function useChartBrush(
  chartRef: RefObject<ReactEchartsRef>,
  widgetIndex: number,
  {isDisabled = false} = {}
) {
  const {focusArea: focusArea, addFocusArea, removeFocusArea} = useDDMContext();
  const router = useRouter();

  const onBrushEnd = params => {
    if (isDisabled) {
      return;
    }

    const rect = params.areas[0];
    if (!rect) {
      return;
    }

    addFocusArea({
      widgetIndex,
      coordinates: {
        x: rect.range[0],
        y: rect.range[1],
      },
      datapoints: {
        x: rect.coordRange[0],
        y: rect.coordRange[1],
      },
    });
  };

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
    removeFocusArea();
  }, [focusArea, removeFocusArea, router]);

  const renderOverlay = focusArea && focusArea.widgetIndex === widgetIndex;

  const brushOptions = {
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

  if (renderOverlay) {
    return {
      overlay: (
        <BrushRectOverlay
          rect={focusArea}
          onRemove={removeFocusArea}
          onZoom={handleZoomIn}
        />
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
  const top = Math.min(...rect.coordinates.y);
  const left = Math.min(...rect.coordinates.x);
  const width = Math.max(...rect.coordinates.x) - left;
  const height = Math.max(...rect.coordinates.y) - top;

  return (
    <FocusAreaRect top={top} left={left} width={width} height={height}>
      <FocusAreaRectActions left={left} top={height}>
        <Panel>
          <Button size="sm" disabled>
            {t('Show samples')}
          </Button>
          <Button size="sm" onClick={onZoom}>
            {t('Zoom in')}
          </Button>
          <Button size="sm" onClick={onRemove}>
            {t('Remove')}
          </Button>
        </Panel>
      </FocusAreaRectActions>
    </FocusAreaRect>
  );
}

const FocusAreaRectActions = styled('div')<{
  left: number;
  top: number;
}>`
  position: absolute;
  top: ${p => p.top}px;
  left: 0px;
  gap: ${space(1)};
  z-index: 2;
`;

const FocusAreaRect = styled('div')<{
  height: number;
  left: number;
  top: number;
  width: number;
}>`
  position: absolute;
  top: ${p => p.top}px;
  left: ${p => p.left}px;
  width: ${p => p.width}px;
  height: ${p => p.height}px;
  outline: 2px solid ${p => p.theme.purple300};
  outline-offset: -1px;
  padding: ${space(1)};
  z-index: 1;
`;
