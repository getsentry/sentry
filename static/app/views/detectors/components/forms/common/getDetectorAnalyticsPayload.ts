import type {
  CronDetector,
  Detector,
  MetricDetector,
  SnubaQuery,
  UptimeDetector,
} from 'sentry/types/workflowEngine/detectors';
import type {MonitorConfig} from 'sentry/views/insights/crons/types';

type MetricDetectorAnalytics = {
  detector_type: MetricDetector['type'];
  aggregate?: SnubaQuery['aggregate'];
  dataset?: SnubaQuery['dataset'];
};

type UptimeDetectorAnalytics = {
  detector_type: UptimeDetector['type'];
  uptime_mode: UptimeDetector['config']['mode'];
};

type MonitorDetectorAnalytics = {
  cron_schedule_type: MonitorConfig['schedule_type'] | undefined;
  detector_type: CronDetector['type'];
};

type ErrorDetectorAnalytics = {
  detector_type: Extract<Detector['type'], 'error' | 'issue_stream'>;
};

type DetectorAnalyticsPayload =
  | MetricDetectorAnalytics
  | UptimeDetectorAnalytics
  | MonitorDetectorAnalytics
  | ErrorDetectorAnalytics;

export function getDetectorAnalyticsPayload(
  detector: Detector
): DetectorAnalyticsPayload {
  switch (detector.type) {
    case 'metric_issue': {
      const snubaQuery = detector.dataSources[0]?.queryObj?.snubaQuery;
      return {
        detector_type: detector.type,
        aggregate: snubaQuery?.aggregate,
        dataset: snubaQuery?.dataset,
      };
    }
    case 'uptime_domain_failure':
      return {
        detector_type: detector.type,
        uptime_mode: detector.config.mode,
      };
    case 'monitor_check_in_failure': {
      const monitorConfig = detector.dataSources[0]?.queryObj?.config;
      return {
        cron_schedule_type: monitorConfig?.schedule_type,
        detector_type: detector.type,
      };
    }
    default:
      return {detector_type: detector.type};
  }
}
