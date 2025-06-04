export type MonitorsEventParameters = {
  'landing_page.platform_guide.viewed': {
    guide: string;
    platform: string;
  };
};

type MonitorsAnalyticsKey = keyof MonitorsEventParameters;

export const monitorsEventMap: Record<MonitorsAnalyticsKey, string> = {
  'landing_page.platform_guide.viewed': 'Crons Landing Page: Viewed Platform Guide',
};
