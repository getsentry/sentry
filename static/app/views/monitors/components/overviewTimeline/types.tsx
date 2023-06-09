export type TimeWindow = '1h' | '24h' | '7d' | '30d';

export interface TimeWindowOptions {
  /**
   * Props to pass to <DateTime> when displaying a time marker
   */
  dateTimeProps: {dateOnly?: boolean; timeOnly?: boolean};
  /**
   * The elapsed minutes based on the selected resolution
   */
  elapsedMinutes: number;
  /**
   * The interval between each grid line and time label in minutes
   */
  timeMarkerInterval: number;
}

export type TimeWindowData = Record<TimeWindow, TimeWindowOptions>;
