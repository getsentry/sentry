import type {Organization} from 'sentry/types/organization';
import makeAnalyticsFunction from 'sentry/utils/analytics/makeAnalyticsFunction';

import type {Subscription} from 'getsentry/types';

// The event keys sent to analytics service
export enum SpendVisibilityEvents {
  SP_DOCS_CLICKED = 'spend-visibility.spike-protection_docs_clicked',
  SP_DISCOVER_CLICKED = 'spend-visibility.spike-protection_discover_clicked',
  SP_PROJECT_TOGGLED = 'spend-visibility.spike-protection_project_toggled',
  SP_PROJECT_SEARCHED = 'spend-visibility.spike-protection_project_searched',
  SP_SETTINGS_VIEWED = 'spend-visibility.spike-protection_settings_viewed',
}

// The base params for these analytics
export type SpendVisibilityBaseParams = {
  subscription?: Subscription;
  view?: 'spike_protection_settings' | 'project_settings' | 'project_stats';
};

// The parameters required for each event type
type SpendVisibilityEventParameters = {
  [SpendVisibilityEvents.SP_DOCS_CLICKED]: SpendVisibilityBaseParams & {};
  [SpendVisibilityEvents.SP_DISCOVER_CLICKED]: SpendVisibilityBaseParams & {};
  [SpendVisibilityEvents.SP_PROJECT_TOGGLED]: SpendVisibilityBaseParams & {
    project_id: string;
    value: boolean;
  };
  [SpendVisibilityEvents.SP_PROJECT_SEARCHED]: SpendVisibilityBaseParams & {};
  [SpendVisibilityEvents.SP_SETTINGS_VIEWED]: SpendVisibilityBaseParams & {};
};

// A mapping of event key to readable, searchable name
const spendVisibilityEventMap: Record<SpendVisibilityEvents, string> = {
  [SpendVisibilityEvents.SP_DOCS_CLICKED]: 'Spike Protection: Docs Clicked',
  [SpendVisibilityEvents.SP_DISCOVER_CLICKED]: 'Spike Protection: Discover Clicked',
  [SpendVisibilityEvents.SP_PROJECT_TOGGLED]: 'Spike Protection: Project Toggled',
  [SpendVisibilityEvents.SP_PROJECT_SEARCHED]: 'Spike Protection: Project Searched',
  [SpendVisibilityEvents.SP_SETTINGS_VIEWED]: 'Spike Protection: Settings Viewed',
};

// The type-safe analytics function generated
const trackSpendVisibilityAnaltyics = makeAnalyticsFunction<
  SpendVisibilityEventParameters,
  {organization: Organization}
>(spendVisibilityEventMap);

export default trackSpendVisibilityAnaltyics;
