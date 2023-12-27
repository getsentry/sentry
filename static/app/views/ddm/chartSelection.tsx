import {useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import theme from 'sentry/utils/theme';
import useRouter from 'sentry/utils/useRouter';

type Selection = {
  coordinates: {
    x: number[];
    y: number[];
  };
  datapoints: {
    x: number[];
    y: number[];
  };
};

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

export function useChartSelection(chartRef: any) {
  // Since the charts are in the same group the onBrushEnd event gets fired for all
  // so we need to keep track of which one is selecting

  const [selection, setSelection] = useState<Selection | null>(null);
  const router = useRouter();

  const onBrushEnd = params => {
    if (selection) {
      return;
    }
    const rect = params.areas[0];
    if (!rect) {
      return;
    }

    setSelection({
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

  const removeSelection = () => {
    setSelection(null);
  };

  const startSelection = () => {
    if (selection) {
      return;
    }
    chartRef.current?.getEchartsInstance().dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: {
        brushType: 'rect',
      },
    });
  };

  const cancelSelection = () => {
    removeSelection();
  };

  const zoomInSelection = () => {
    const startFormatted = getDate(selection?.datapoints.x[0]);
    const endFormatted = getDate(selection?.datapoints.x[1]);

    updateDateTime(
      {
        period: null,
        start: startFormatted ? getUtcToLocalDateObject(startFormatted) : startFormatted,
        end: endFormatted ? getUtcToLocalDateObject(endFormatted) : endFormatted,
      },
      router,
      {save: true}
    );
    removeSelection();
  };

  if (selection) {
    return {
      overlay: (
        <SelectionOverlay
          selection={selection}
          onRemove={removeSelection}
          onZoom={zoomInSelection}
        />
      ),
      startSelection,
      options: {},
    };
  }

  return {
    overlay: null,
    startSelection,
    cancelSelection,
    options: {
      onBrushEnd,
      toolBox: {
        show: false,
      },
      brush: {
        toolbox: ['rect'] as any,
        xAxisIndex: 0,
        brushStyle: {
          borderWidth: 2,
          borderColor: theme.purple300,
          color: 'transparent',
        },
        z: 10,
      },
    },
  };
}

function SelectionOverlay({selection, onZoom, onRemove}) {
  if (!selection) {
    return null;
  }
  const top = Math.min(...selection.coordinates.y);
  const left = Math.min(...selection.coordinates.x);
  const width = Math.max(...selection.coordinates.x) - left;
  const height = Math.max(...selection.coordinates.y) - top;

  return (
    <StyledSelection top={top} left={left} width={width} height={height}>
      <div>
        <Button size="sm" disabled>
          {t('Show samples')}
        </Button>
        <Button size="sm" onClick={onZoom}>
          {t('Zoom in')}
        </Button>
        <Button size="sm" onClick={onRemove}>
          {t('Remove')}
        </Button>
      </div>
    </StyledSelection>
  );
}

const StyledSelection = styled('div')<{
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

  & > div {
    display: none;
  }

  :hover {
    & > div {
      display: flex;
    }
  }
`;
