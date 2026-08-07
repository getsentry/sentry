export type TimePeriodType = {
  display: React.ReactNode;
  end: string;
  label: string;
  period: string;
  start: string;
  /**
   * The start/end were chosen from the period and not the user
   */
  usingPeriod: boolean;
  custom?: boolean;
  utc?: boolean;
};
