type MobilePromptBannerParams = {
  userAgentMatches: boolean;
  matchedUserAgentString: string;
  hasMobileProject: boolean;
  snoozedOrDismissed: boolean;
};

//define the event key to payload mappings
export type EventParameters = {
  'growth.check_show_mobile_prompt_banner': MobilePromptBannerParams;
};

type AnalyticsKey = keyof EventParameters;

export const eventNameMap: Record<AnalyticsKey, string> = {
  'growth.check_show_mobile_prompt_banner': 'Growth: Check Show Mobile Prompt Banner',
};
