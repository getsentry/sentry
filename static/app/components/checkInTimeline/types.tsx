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
  roundedLeft: boolean;
  roundedRight: boolean;
  startTs: number;
  stats: StatsBucket<Status>;
  width: number;
}

export type StatsBucket<Status extends string> = Record<Status, number>;
