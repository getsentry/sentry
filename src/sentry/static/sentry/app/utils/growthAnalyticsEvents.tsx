type MobilePromptBannerParams = {
  matchedUserAgentString: string;
};

type CheckShowParams = MobilePromptBannerParams & {
  userAgentMatches: boolean;
  matchedUserAgentString: string;
  hasMobileProject: boolean;
  snoozedOrDismissed: boolean;
  mobileEventBrowserName: string;
  mobileEventClientOsName: string;
  showCTA: boolean;
};

//define the event key to payload mappings
export type GrowthEventParameters = {
  'growth.check_show_mobile_prompt_banner': CheckShowParams;
  'growth.dismissed_mobile_prompt_banner': MobilePromptBannerParams;
  'growth.opened_mobile_project_suggest_modal': MobilePromptBannerParams;
  'growth.clicked_mobile_prompt_setup_project': MobilePromptBannerParams;
  'growth.clicked_mobile_prompt_ask_teammate': MobilePromptBannerParams;
  'growth.submitted_mobile_prompt_ask_teammate': MobilePromptBannerParams;
};

type GrowthAnalyticsKey = keyof GrowthEventParameters;

export const growthEventMap: Record<GrowthAnalyticsKey, string> = {
  'growth.check_show_mobile_prompt_banner': 'Growth: Check Show Mobile Prompt Banner',
  'growth.dismissed_mobile_prompt_banner': 'Growth: Dismissed Mobile Prompt Banner',
  'growth.opened_mobile_project_suggest_modal':
    'Growth: Open Mobile Project Suggest Modal',
  'growth.clicked_mobile_prompt_setup_project':
    'Growth: Clicked Mobile Prompt Setup Project',
  'growth.clicked_mobile_prompt_ask_teammate':
    'Growth: Clicked Mobile Prompt Ask Teammate',
  'growth.submitted_mobile_prompt_ask_teammate':
    'Growth: Submitted Mobile Prompt Ask Teammate',
};
