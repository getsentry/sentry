export interface DetectorDetails {
  description?: string;
  detectorId?: string;
  detectorPath?: string;
  detectorSlug?: string;
  detectorType?:
    | 'metric_alert'
    | 'cron_monitor'
    | 'uptime_monitor'
    | 'mobile_build_monitor';
}
