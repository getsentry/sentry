import {PlatformKey} from 'app/data/platformCategories';

type MobilePromptBannerParams = {
  matchedUserAgentString: string;
};

type ShowParams = MobilePromptBannerParams & {
  matchedUserAgentString: string;
  mobileEventBrowserName: string;
  mobileEventClientOsName: string;
};

type PlatformParam = {
  platform: PlatformKey;
};

type PlatformCategory = {
  category: string;
};

type PlatformPickerParam = {
  platformId: string;
  source: string | null | undefined;
};

type PlatformSearchParam = {
  search: string;
};

// define the event key to payload mappings
export type GrowthEventParameters = {
  'growth.show_mobile_prompt_banner': ShowParams;
  'growth.dismissed_mobile_prompt_banner': MobilePromptBannerParams;
  'growth.opened_mobile_project_suggest_modal': MobilePromptBannerParams;
  'growth.clicked_mobile_prompt_setup_project': MobilePromptBannerParams;
  'growth.clicked_mobile_prompt_ask_teammate': MobilePromptBannerParams;
  'growth.submitted_mobile_prompt_ask_teammate': MobilePromptBannerParams;
  'growth.demo_click_get_started': {};
  'growth.demo_click_docs': {};
  'growth.demo_click_request_demo': {};
  'growth.onboarding_im_ready': {};
  'growth.onboarding_skip_onboarding': {};
  'growth.onboarding_set_up_your_project': PlatformParam;
  'growth.onboarding_select_platform': PlatformPickerParam;
  'growth.onboarding_platform_category': PlatformCategory;
  'growth.onboarding_platform_search': PlatformSearchParam;
  'growth.onboarding_start_onboarding': {};
  'growth.onboarding_take_to_error': {};
  'growth.onboarding_view_full_docs': {};
  'growth.onboarding_view_sample_event': {};
};

type GrowthAnalyticsKey = keyof GrowthEventParameters;

export const growthEventMap: Record<GrowthAnalyticsKey, string> = {
  'growth.show_mobile_prompt_banner': 'Growth: Show Mobile Prompt Banner',
  'growth.dismissed_mobile_prompt_banner': 'Growth: Dismissed Mobile Prompt Banner',
  'growth.opened_mobile_project_suggest_modal':
    'Growth: Open Mobile Project Suggest Modal',
  'growth.clicked_mobile_prompt_setup_project':
    'Growth: Clicked Mobile Prompt Setup Project',
  'growth.clicked_mobile_prompt_ask_teammate':
    'Growth: Clicked Mobile Prompt Ask Teammate',
  'growth.submitted_mobile_prompt_ask_teammate':
    'Growth: Submitted Mobile Prompt Ask Teammate',
  'growth.demo_click_get_started': 'Growth: Demo Click Get Started',
  'growth.demo_click_docs': 'Growth: Demo Click Docs',
  'growth.demo_click_request_demo': 'Growth: Demo Click Request Demo',
  'growth.onboarding_im_ready': "Growth: Onboarding Click I'm Ready",
  'growth.onboarding_skip_onboarding': 'Growth: Onboarding Click Skip Onboarding',
  'growth.onboarding_set_up_your_project': 'Growth: Onboarding Click Set Up Your Project',
  'growth.onboarding_select_platform': 'Growth: Onboarding Choose Platform',
  'growth.onboarding_platform_category': 'Growth: Onboarding Platform Category',
  'growth.onboarding_platform_search': 'Growth: Onboarding Platform Search',
  'growth.onboarding_start_onboarding': 'Growth: Onboarding Start Onboarding',
  'growth.onboarding_take_to_error': 'Growth: OnboardingTake to Error',
  'growth.onboarding_view_full_docs': 'Growth: Onboarding View Full Docs',
  'growth.onboarding_view_sample_event': 'Growth: Onboarding View Sample Event',
};
