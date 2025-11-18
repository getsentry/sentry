import type {Organization} from 'sentry/types/organization';
import {getAutomationAnalyticsPayload} from 'sentry/views/automations/components/forms/common/getAutomationAnalyticsPayload';

type AutomationAnalyticsEventPayload = ReturnType<typeof getAutomationAnalyticsPayload>;

export type MonitorsEventParameters = {
  'automation.created': AutomationAnalyticsEventPayload & {
    organization: Organization;
  };
  'automation.updated': AutomationAnalyticsEventPayload & {
    organization: Organization;
  };
  'landing_page.platform_guide.viewed': {
    guide: string;
    platform: string;
  };
};

type MonitorsAnalyticsKey = keyof MonitorsEventParameters;

export const monitorsEventMap: Record<MonitorsAnalyticsKey, string> = {
  'landing_page.platform_guide.viewed': 'Crons Landing Page: Viewed Platform Guide',
  'automation.created': 'Automations: Created',
  'automation.updated': 'Automations: Updated',
};
