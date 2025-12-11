import type {Organization} from 'sentry/types/organization';
import type {getAutomationAnalyticsPayload} from 'sentry/views/automations/components/forms/common/getAutomationAnalyticsPayload';
import type {getDetectorAnalyticsPayload} from 'sentry/views/detectors/components/forms/common/getDetectorAnalyticsPayload';

type DetectorAnalyticsEventPayload = ReturnType<typeof getDetectorAnalyticsPayload>;

type AutomationAnalyticsEventPayload = ReturnType<typeof getAutomationAnalyticsPayload>;

type DetectorCreateAnalyticsEventPayload =
  | (DetectorAnalyticsEventPayload & {
      success: true;
    })
  | {detector_type: string; success: false};

export type MonitorsEventParameters = {
  'automation.created': AutomationAnalyticsEventPayload & {
    organization: Organization;
    success: boolean;
  };
  'automation.updated': AutomationAnalyticsEventPayload & {
    organization: Organization;
  };
  'landing_page.platform_guide.viewed': {
    guide: string;
    platform: string;
  };
  'monitor.created': DetectorCreateAnalyticsEventPayload;
  'monitor.updated': DetectorAnalyticsEventPayload;
};

type MonitorsAnalyticsKey = keyof MonitorsEventParameters;

export const monitorsEventMap: Record<MonitorsAnalyticsKey, string> = {
  'landing_page.platform_guide.viewed': 'Crons Landing Page: Viewed Platform Guide',
  'monitor.created': 'Detectors: Created',
  'monitor.updated': 'Detectors: Updated',
  'automation.created': 'Automations: Created',
  'automation.updated': 'Automations: Updated',
};
