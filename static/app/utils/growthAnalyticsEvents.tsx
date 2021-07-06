import {PlatformKey} from 'app/data/platformCategories';
import {PlatformIntegration} from 'app/types';

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

type PlatformPick = {
  platform: PlatformIntegration;
};

type PlatformCategory = {
  category: string;
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
  'growth.skip_onboarding': {};
  'growth.set_up_your_project': PlatformParam;
  'growth.platform_pick': PlatformPick;
  'growth.platform_category': PlatformCategory;
  'growth.start_onboarding': {};
  'growth.take_to_error': {};
  'growth.view_full_docs': {};
  'growth.view_sample_event': {};
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
  'growth.onboarding_im_ready': "Growth: Click I'm Ready",
  'growth.skip_onboarding': 'Growth: Click Skip Onboarding',
  'growth.set_up_your_project': 'Growth: Click Set Up Your Project',
  'growth.platform_pick': 'Growth: Choose Platform',
  'growth.platform_category': 'Growth: Platform Category',
  'growth.start_onboarding': 'Growth: Start Onboarding',
  'growth.take_to_error': 'Growth: Take to Error',
  'growth.view_full_docs': 'Growth: View Full Docs',
  'growth.view_sample_event': 'Growth: View Sample Event',
};
