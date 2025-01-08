import type {DateTimeProps} from 'sentry/components/dateTime';
import type {CheckInStatus} from 'sentry/views/monitors/types';

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
   * The start of the window
   */
  start: Date;
  /**
   * The width in pixels of the timeline
   */
  timelineWidth: number;
}

export type MonitorBucket = [timestamp: number, envData: MonitorBucketEnvMapping];
export type MonitorBucketWithStats = [timestamp: number, stats: StatsBucket];

export interface JobTickData {
  endTs: number;
  envMapping: MonitorBucketEnvMapping;
  roundedLeft: boolean;
  roundedRight: boolean;
  startTs: number;
  width: number;
}

export interface JobTickDataWithStats {
  endTs: number;
  roundedLeft: boolean;
  roundedRight: boolean;
  startTs: number;
  stats: StatsBucket;
  width: number;
}

export type StatsBucket = {
  [CheckInStatus.IN_PROGRESS]: number;
  [CheckInStatus.OK]: number;
  [CheckInStatus.MISSED]: number;
  [CheckInStatus.TIMEOUT]: number;
  [CheckInStatus.ERROR]: number;
  [CheckInStatus.UNKNOWN]: number;
};

export type MonitorBucketEnvMapping = Record<string, StatsBucket>;
