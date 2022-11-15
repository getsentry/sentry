export type MonitorsEventParameters = {};

type MonitorsAnalyticsKey = keyof MonitorsEventParameters;

export const monitorsEventMap: Record<MonitorsAnalyticsKey, string> = {};
