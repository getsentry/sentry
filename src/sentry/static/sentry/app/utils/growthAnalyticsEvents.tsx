type MobilePromptBannerParams = {
  userAgentMatches: boolean;
  matchedUserAgentString: string;
  hasMobileProject: boolean;
  snoozedOrDismissed: boolean;
};

//define the event key to payload mappings
export type GrowthEventParameters = {
  'growth.check_show_mobile_prompt_banner': MobilePromptBannerParams;
};

type GrowthAnalyticsKey = keyof GrowthEventParameters;

export const growthEventMap: Record<GrowthAnalyticsKey, string> = {
  'growth.check_show_mobile_prompt_banner': 'Growth: Check Show Mobile Prompt Banner',
};
