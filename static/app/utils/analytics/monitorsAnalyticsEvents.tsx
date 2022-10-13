export type MonitorsEventParameters = {
  'monitors.page_viewed': {};
};

type MonitorsAnalyticsKey = keyof MonitorsEventParameters;

export const monitorsEventMap: Record<MonitorsAnalyticsKey, string> = {
  'monitors.page_viewed': 'Monitors: Page Viewed',
};
