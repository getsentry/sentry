import {useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
} from 'echarts';

import {defined} from 'sentry/utils/defined';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {
  groupIntoBuckets,
  SEVERITY_OPACITIES,
  type AnnotationBucket,
} from 'sentry/views/explore/components/chart/droppedDataBand/utils';

export const DROPPED_DATA_SERIES_ID = '__dropped_data__';

// TODO: this should change to read from the outcome property when backend changes are in
const CLIENT_DISCARD_LABEL = 'Client discard';

// Styling constants
const BAR_SLOT_FILL = 0.69;
const BAND_PADDING = 4;
const BOX_HEIGHT = 8;
export const BAND_HEIGHT = BAND_PADDING + BOX_HEIGHT + BAND_PADDING;
const BOX_BORDER_RADIUS = 2;

function severityOpacity(severity: number): number {
  return SEVERITY_OPACITIES[severity - 1] ?? 1;
}

/**
 * The buckets that will actually be drawn. "Client discards" are filtered out
 * to prevent noisy data cluttering the band
 */
function getVisibleBuckets(annotations: Annotation[] | undefined): AnnotationBucket[] {
  return groupIntoBuckets(
    (annotations ?? []).filter(annotation => annotation.label !== CLIENT_DISCARD_LABEL)
  ).filter(bucket => bucket.severity > 0);
}
const DROPPED_DATA_Y_AXIS = {
  type: 'value' as const,
  min: 0,
  max: 100,
  show: false,
  axisLabel: {show: false},
  axisPointer: {show: false},
};

interface DroppedDataItem extends AnnotationBucket {
  value: [start: number, y: number];
}

interface DroppedDataSeriesProps {
  bandOffset: number;
  buckets: AnnotationBucket[];
  theme: Theme;
  yAxisIndex?: number;
}

function createDroppedDataSeries({
  bandOffset,
  buckets,
  theme,
  yAxisIndex,
}: DroppedDataSeriesProps): CustomSeriesOption {
  const data: DroppedDataItem[] = buckets.map(bucket => ({
    value: [bucket.start, 0],
    ...bucket,
  }));

  const renderDroppedDataBox: CustomSeriesRenderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ) => {
    const dataItem = data[params.dataIndex];

    if (!dataItem) {
      return null;
    }

    const [boxStartX, boxStartY] = api.coord([dataItem.start, 0]);
    const [boxEndX] = api.coord([dataItem.end, 0]);

    if (!defined(boxStartX) || !defined(boxStartY) || !defined(boxEndX)) {
      return null;
    }

    const boxWidth = (boxEndX - boxStartX) * BAR_SLOT_FILL;
    const boxTop = boxStartY + bandOffset + BAND_PADDING;

    return {
      // The single severity box. Its hue/intensity encodes severity.
      type: 'rect',
      shape: {
        x: boxStartX - boxWidth / 2,
        y: boxTop,
        width: boxWidth,
        height: BOX_HEIGHT,
        r: BOX_BORDER_RADIUS,
      },
      style: {
        fill: theme.tokens.dataviz.semantic.bad,
        opacity: severityOpacity(dataItem.severity),
      },
    } satisfies CustomSeriesRenderItemReturn;
  };

  return {
    id: DROPPED_DATA_SERIES_ID,
    type: 'custom',
    yAxisIndex,
    renderItem: renderDroppedDataBox,
    name: DROPPED_DATA_SERIES_ID,
    data,
    color: theme.tokens.dataviz.semantic.bad,
    animation: false,
    legendHoverLink: false,
    // TODO: modify this when adding tooltip support. `trigger: 'item'` has to
    // stay either way, since it is what keeps the band out of the chart-level
    // `trigger: 'axis'` tooltip's series list.
    silent: true,
    tooltip: {trigger: 'item', formatter: () => ''},
  };
}

interface UseDroppedDataBandParams {
  annotations?: Annotation[];
  bandOffset?: number;
  showDroppedData?: boolean;
  yAxisIndex?: number;
}

export function useDroppedDataBand({
  annotations,
  showDroppedData = true,
  bandOffset = 0,
  yAxisIndex,
}: UseDroppedDataBandParams) {
  const theme = useTheme();

  const buckets = useMemo(() => getVisibleBuckets(annotations), [annotations]);
  const isVisible = showDroppedData && buckets.length > 0;

  const droppedDataSeries = useMemo(
    () =>
      isVisible
        ? createDroppedDataSeries({bandOffset, buckets, theme, yAxisIndex})
        : null,
    [bandOffset, buckets, isVisible, theme, yAxisIndex]
  );

  return {
    droppedDataSeries,

    droppedDataYAxis: isVisible ? DROPPED_DATA_Y_AXIS : null,
    droppedDataBandHeight: isVisible ? BAND_HEIGHT : 0,
  };
}
