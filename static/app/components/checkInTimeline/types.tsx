import type {Theme} from '@emotion/react';

import type {DateTimeProps} from 'sentry/components/dateTime';

export type TimeWindow = '1h' | '24h' | '7d' | '30d';

interface MarkerIntervals {
  /**
   * The smallest number of minutes a marker mmay represent
   */
  minimumMarkerInterval: number;
  /**
   * The number of minutes "inner" markers represent. These are the markers
   * that are aligned to a reasonable start.
   */
  normalMarkerInterval: number;
  /**
   * The number of minutes after the reference marker (start time) before we
   * shoulds start showing
   */
  referenceMarkerInterval: number;
}

export interface RollupConfig {
  /**
   * How many pixels does a single bucket take up? May be order of two
   * fractional pixels (0.5, 0.25, 0.125 etc)
   */
  bucketPixels: number;
  /**
   * The actual interval (number of seconds in a bucket)
   */
  interval: number;
  /**
   * How much underscan did we produce for this candidate interval
   */
  timelineUnderscanWidth: number;
  /**
   * How many total number of buckets are we fitting into our timeline
   */
  totalBuckets: number;
  /**
   * How many total buckets are part of the underscan area
   */
  underscanBuckets: number;
  /**
   * The negative pixel offset that must be applied to all ticks when the
   * underscan width cannot evenly fit each bucket. This happens because the
   * underscan is the "remaining" size of the timeine container and thus will
   * not always be an even multiple of the pixel bucket size.
   */
  underscanStartOffset: number;
}

export interface TimeWindowConfig {
  /**
   * The time format used for the cursor label and job tick tooltip
   */
  dateLabelFormat: string;
  /**
   * Props to pass to <DateTime> when displaying a time marker
   */
  dateTimeProps: Partial<DateTimeProps>;
  /**
   * The elapsed minutes based on the selected resolution
   */
  elapsedMinutes: number;
  /**
   * The end of the window
   */
  end: Date;
  /**
   * Configuraton for marker intervals
   */
  intervals: MarkerIntervals;
  /**
   * The start of the window excluding the underscan period.
   */
  periodStart: Date;
  /**
   * Configures how check-ins are bucketed into the timeline
   */
  rollupConfig: RollupConfig;
  /**
   * The start of the window.
   *
   * NOTE that this includes the underscan period. The periodStart value is
   * what the selected period is actually configured for.
   */
  start: Date;
  /**
   * The width in pixels of the timeline. This value is clamped such that there
   * may be some underscan, this value does not include the width of the
   * underscan. See the RollupConfig for more details.
   */
  timelineWidth: number;
  /**
   * The timezone to use for grid line calculations and date formatting
   */
  timezone: string;
}

interface StatusStyle {
  /**
   * The color of the tooltip label
   */
  labelColor: string;
  /**
   * The color of the tick
   */
  tickColor: string;
  /**
   * Use a cross hatch fill for the tick instead of a solid color. The tick
   * color will be used as the border color
   */
  hatchTick?: string;
}

export type TickStyle<Status extends string> = (
  theme: Theme
) => Record<Status, StatusStyle>;

export type CheckInBucket<Status extends string> = [
  timestamp: number,
  stats: StatsBucket<Status>,
];

export interface JobTickData<Status extends string> {
  endTs: number;
  isEnding: boolean;
  isStarting: boolean;
  left: number;
  startTs: number;
  stats: StatsBucket<Status>;
  width: number;
}

export type StatsBucket<Status extends string> = Record<Status, number>;
