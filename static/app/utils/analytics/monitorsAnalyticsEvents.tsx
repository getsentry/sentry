export type MonitorsEventParameters = {
  'landing_page.platform_guide.viewed': {
    guide: string;
    platform: string;
  };
  'monitor.created': {
    detector_type:
      | 'error'
      | 'metric_issue'
      | 'uptime_domain_failure'
      | 'monitor_check_in_failure';
    aggregate?: string;
    dataset?: string;
  };
  'monitor.updated': {
    detector_type:
      | 'error'
      | 'metric_issue'
      | 'uptime_domain_failure'
      | 'monitor_check_in_failure';
    aggregate?: string;
    dataset?: string;
  };
};

type MonitorsAnalyticsKey = keyof MonitorsEventParameters;

export const monitorsEventMap: Record<MonitorsAnalyticsKey, string> = {
  'landing_page.platform_guide.viewed': 'Crons Landing Page: Viewed Platform Guide',
  'monitor.created': 'Detectors: Created',
  'monitor.updated': 'Detectors: Updated',
};
