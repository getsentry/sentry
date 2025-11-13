import type {getDetectorAnalyticsPayload} from 'sentry/views/detectors/components/forms/common/getDetectorAnalyticsPayload';

type DetectorAnalyticsEventPayload = ReturnType<typeof getDetectorAnalyticsPayload>;

export type MonitorsEventParameters = {
  'landing_page.platform_guide.viewed': {
    guide: string;
    platform: string;
  };
  'monitor.created': DetectorAnalyticsEventPayload;
  'monitor.updated': DetectorAnalyticsEventPayload;
};

type MonitorsAnalyticsKey = keyof MonitorsEventParameters;

export const monitorsEventMap: Record<MonitorsAnalyticsKey, string> = {
  'landing_page.platform_guide.viewed': 'Crons Landing Page: Viewed Platform Guide',
  'monitor.created': 'Detectors: Created',
  'monitor.updated': 'Detectors: Updated',
};
