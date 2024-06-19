import {t} from 'sentry/locale';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';

export enum MobileCursors {
  SPANS_TABLE = 'spansCursor',
  SCREENS_TABLE = 'screensCursor',
  RELEASE_1_EVENT_SAMPLE_TABLE = 'release1Cursor',
  RELEASE_2_EVENT_SAMPLE_TABLE = 'release2Cursor',
}

export enum MobileSortKeys {
  RELEASE_1_EVENT_SAMPLE_TABLE = 'release1Samples',
  RELEASE_2_EVENT_SAMPLE_TABLE = 'release2Samples',
}

export enum YAxis {
  WARM_START = 0,
  COLD_START = 1,
  TTID = 2,
  TTFD = 3,
  SLOW_FRAME_RATE = 4,
  FROZEN_FRAME_RATE = 5,
  THROUGHPUT = 6,
  COUNT = 7,
  SLOW_FRAMES = 8,
  FROZEN_FRAMES = 9,
  FRAMES_DELAY = 10,
}

export const YAXIS_COLUMNS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(measurements.app_start_warm)',
  [YAxis.COLD_START]: 'avg(measurements.app_start_cold)',
  [YAxis.TTID]: 'avg(measurements.time_to_initial_display)',
  [YAxis.TTFD]: 'avg(measurements.time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(measurements.frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(measurements.frames_frozen_rate)',
  [YAxis.THROUGHPUT]: 'tpm()',
  [YAxis.COUNT]: 'count()',

  // Using span metrics
  [YAxis.SLOW_FRAMES]: 'avg(mobile.slow_frames)',
  [YAxis.FROZEN_FRAMES]: 'avg(mobile.frozen_frames)',
  [YAxis.FRAMES_DELAY]: 'avg(mobile.frames_delay)',
};

export const READABLE_YAXIS_LABELS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(app_start_warm)',
  [YAxis.COLD_START]: 'avg(app_start_cold)',
  [YAxis.TTID]: 'avg(time_to_initial_display)',
  [YAxis.TTFD]: 'avg(time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(frames_frozen_rate)',
  [YAxis.THROUGHPUT]: 'tpm()',
  [YAxis.COUNT]: 'count()',
  [YAxis.SLOW_FRAMES]: 'avg(mobile.slow_frames)',
  [YAxis.FROZEN_FRAMES]: 'avg(mobile.frozen_frames)',
  [YAxis.FRAMES_DELAY]: 'avg(mobile.frames_delay)',
};

export const CHART_TITLES: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: t('Warm Start'),
  [YAxis.COLD_START]: t('Cold Start'),
  [YAxis.TTID]: t('Time To Initial Display'),
  [YAxis.TTFD]: t('Time To Full Display'),
  [YAxis.SLOW_FRAME_RATE]: t('Slow Frame Rate'),
  [YAxis.FROZEN_FRAME_RATE]: t('Frozen Frame Rate'),
  [YAxis.THROUGHPUT]: t('Throughput'),
  [YAxis.COUNT]: t('Total Count'),
  [YAxis.SLOW_FRAMES]: t('Slow Frames'),
  [YAxis.FROZEN_FRAMES]: t('Frozen Frames'),
  [YAxis.FRAMES_DELAY]: t('Frames Delay'),
};

export const OUTPUT_TYPE: Readonly<Record<YAxis, AggregationOutputType>> = {
  [YAxis.WARM_START]: 'duration',
  [YAxis.COLD_START]: 'duration',
  [YAxis.TTID]: 'duration',
  [YAxis.TTFD]: 'duration',
  [YAxis.SLOW_FRAME_RATE]: 'percentage',
  [YAxis.FROZEN_FRAME_RATE]: 'percentage',
  [YAxis.THROUGHPUT]: 'number',
  [YAxis.COUNT]: 'number',
  [YAxis.SLOW_FRAMES]: 'number',
  [YAxis.FROZEN_FRAMES]: 'number',
  [YAxis.FRAMES_DELAY]: 'duration',
};
