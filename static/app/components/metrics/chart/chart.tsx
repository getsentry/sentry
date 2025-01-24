import Color from 'color';
import type {ZRLineType} from 'echarts/types/src/util/types';

import type {Series} from 'sentry/types/echarts';

import {ChartType} from '../../../views/insights/common/components/chart';

const AVERAGE_INGESTION_DELAY_MS = 90_000;
/**
 * Calculates the number of buckets, affected by ingestion delay.
 * Based on the AVERAGE_INGESTION_DELAY_MS
 * @param bucketSize in ms
 * @param lastBucketTimestamp starting time of the last bucket in ms
 */
export function getIngestionDelayBucketCount(
  bucketSize: number,
  lastBucketTimestamp: number
) {
  const timeSinceLastBucket = Date.now() - (lastBucketTimestamp + bucketSize);
  const ingestionAffectedTime = Math.max(
    0,
    AVERAGE_INGESTION_DELAY_MS - timeSinceLastBucket
  );

  return Math.ceil(ingestionAffectedTime / bucketSize);
}

export function createIngestionSeries(
  orignalSeries: Series,
  ingestionBuckets: number,
  displayType: ChartType
): Series[] {
  if (ingestionBuckets < 1) {
    return [orignalSeries];
  }

  const series = [
    {
      ...orignalSeries,
      data: orignalSeries.data.slice(0, -ingestionBuckets),
    },
  ];

  if (displayType === ChartType.BAR) {
    series.push(createIngestionBarSeries(orignalSeries, ingestionBuckets));
  } else if (displayType === ChartType.AREA) {
    series.push(createIngestionAreaSeries(orignalSeries, ingestionBuckets));
  } else {
    series.push(createIngestionLineSeries(orignalSeries, ingestionBuckets));
  }

  return series;
}

const EXTRAPOLATED_AREA_STRIPE_IMG =
  'image://data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAABkCAYAAAC/zKGXAAAAMUlEQVR4Ae3KoREAIAwEsMKgrMeYj8BzyIpEZyTZda16mPVJFEVRFEVRFEVRFMWO8QB4uATKpuU51gAAAABJRU5ErkJggg==';

const getIngestionSeriesId = (seriesId: string | undefined) => `${seriesId}-ingestion`;

function createIngestionBarSeries(series: Series, fogBucketCnt = 0) {
  return {
    ...series,
    id: getIngestionSeriesId(series.id),
    silent: true,
    data: series.data.map((data, index) => ({
      ...data,
      // W need to set a value for the non-fog of war buckets so that the stacking still works in echarts
      value: index < series.data.length - fogBucketCnt ? 0 : data.value,
    })),
    itemStyle: {
      opacity: 1,
      decal: {
        symbol: EXTRAPOLATED_AREA_STRIPE_IMG,
        dashArrayX: [6, 0],
        dashArrayY: [6, 0],
        rotation: Math.PI / 4,
      },
    },
  };
}

function createIngestionLineSeries(series: Series, fogBucketCnt = 0) {
  return {
    ...series,
    id: getIngestionSeriesId(series.id),
    silent: true,
    // We include the last non-fog of war bucket so that the line is connected
    data: series.data.slice(-fogBucketCnt - 1),
    lineStyle: {
      type: 'dotted' as ZRLineType,
    },
  };
}

function createIngestionAreaSeries(series: Series, fogBucketCnt = 0) {
  return {
    ...series,
    id: getIngestionSeriesId(series.id),
    silent: true,
    stack: 'fogOfWar',
    // We include the last non-fog of war bucket so that the line is connected
    data: series.data.slice(-fogBucketCnt - 1),
    lineStyle: {
      type: 'dotted' as ZRLineType,
      color: Color(series.color).lighten(0.3).string(),
    },
  };
}
