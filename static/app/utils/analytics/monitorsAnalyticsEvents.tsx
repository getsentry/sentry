import type {Organization} from 'sentry/types/organization';
import {getAutomationAnalyticsPayload} from 'sentry/views/automations/components/forms/common/getAutomationAnalyticsPayload';

type AutomationAnalyticsEventPayload = ReturnType<typeof getAutomationAnalyticsPayload>;

export type MonitorsEventParameters = {
  'landing_page.platform_guide.viewed': {
    guide: string;
    platform: string;
  };
};

export type AutomationsEventParameters = {
  'automation.created': AutomationAnalyticsEventPayload & {
    organization: Organization;
  };
  'automation.updated': AutomationAnalyticsEventPayload & {
    organization: Organization;
  };
};

type MonitorsAnalyticsKey = keyof MonitorsEventParameters;
type AutomationsAnalyticsKey = keyof AutomationsEventParameters;

export const monitorsEventMap: Record<MonitorsAnalyticsKey, string> = {
  'landing_page.platform_guide.viewed': 'Crons Landing Page: Viewed Platform Guide',
};

export const automationsEventMap: Record<AutomationsAnalyticsKey, string | null> = {
  'automation.created': 'Automations: Created',
  'automation.updated': 'Automations: Updated',
};
