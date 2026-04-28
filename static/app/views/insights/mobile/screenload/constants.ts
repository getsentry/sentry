import type {SpanProperty} from 'sentry/views/insights/types';

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

export const YAXIS_COLUMNS: Readonly<Record<YAxis, SpanProperty>> = {
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
