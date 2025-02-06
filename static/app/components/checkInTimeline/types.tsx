import type {DateTimeProps} from 'sentry/components/dateTime';
import type {ColorOrAlias} from 'sentry/utils/theme';

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
   * When there is an underscan we also will likely want to query the
   * additional time range for that underscan, this is the additional period of
   * time that the underscan represents in seconds.
   */
  underscanPeriod: number;
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
   * Configures how check-ins are bucketed into the timeline
   */
  rollupConfig: RollupConfig;
  /**
   * When true the underscan help indicator should be rendered after the date
   * time markers.
   */
  showUnderscanHelp: boolean;
  /**
   * The start of the window
   */
  start: Date;
  /**
   * The width in pixels of the timeline. This value is clamped such that there
   * may be some underscan. See the RollupConfig for more details.
   */
  timelineWidth: number;
}

export interface TickStyle {
  /**
   * The color of the tooltip label
   */
  labelColor: ColorOrAlias;
  /**
   * The color of the tick
   */
  tickColor: ColorOrAlias;
  /**
   * Use a cross hatch fill for the tick instead of a solid color. The tick
   * color will be used as the border color
   */
  hatchTick?: ColorOrAlias;
}

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
