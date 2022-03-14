import {PlatformKey} from 'sentry/data/platformCategories';

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
  source?: string;
};

type PlatformPickerParam = {
  platform_id: string;
  source?: string;
};

type PlatformSearchParam = {
  num_results: number;
  search: string;
  source?: string;
};

type SampleEventParam = {
  platform?: PlatformKey;
};

type InviteRequestParam = {
  invite_status: string;
  member_id: number;
};

type InviteModal = {
  modal_session: string;
};

// define the event key to payload mappings
export type GrowthEventParameters = {
  'growth.clicked_enter_sandbox': {
    scenario: string;
    source?: string;
  };
  'growth.clicked_mobile_prompt_ask_teammate': MobilePromptBannerParams;
  'growth.clicked_mobile_prompt_setup_project': MobilePromptBannerParams;
  'growth.demo_click_docs': {};
  'growth.demo_click_get_started': {cta?: string};
  'growth.demo_click_request_demo': {};
  'growth.demo_modal_clicked_continue': {};
  'growth.demo_modal_clicked_signup': {};
  'growth.dismissed_mobile_prompt_banner': MobilePromptBannerParams;
  'growth.issue_open_in_discover_btn_clicked': {};
  'growth.onboarding_clicked_instrument_app': {source?: string};
  'growth.onboarding_clicked_skip': {source?: string};
  'growth.onboarding_load_choose_platform': {};
  'growth.onboarding_set_up_your_project': PlatformParam;
  'growth.onboarding_start_onboarding': {
    source?: string;
  };
  'growth.onboarding_take_to_error': {};
  'growth.onboarding_view_full_docs': {};
  'growth.onboarding_view_sample_event': SampleEventParam;
  'growth.opened_mobile_project_suggest_modal': MobilePromptBannerParams;
  'growth.platformpicker_category': PlatformCategory;
  'growth.platformpicker_search': PlatformSearchParam;
  'growth.sample_error_onboarding_link_clicked': {
    platform?: string;
    project_id?: string;
  };
  'growth.sample_transaction_docs_link_clicked': {
    project_id: string;
  };
  'growth.select_platform': PlatformPickerParam;
  'growth.show_mobile_prompt_banner': ShowParams;
  'growth.submitted_mobile_prompt_ask_teammate': MobilePromptBannerParams;
  'invite_modal.add_more': InviteModal;
  'invite_modal.closed': InviteModal;
  'invite_modal.invites_sent': InviteModal;
  'invite_modal.opened': InviteModal & {
    can_invite: boolean;
    source?: string;
  };
  'invite_modal.requests_sent': InviteModal;
  'invite_request.approved': InviteRequestParam;
  'invite_request.denied': InviteRequestParam;
  'member_settings_page.loaded': {
    num_invite_requests: number;
    num_members: number;
  };
  'sdk_updates.clicked': {};
  'sdk_updates.seen': {};
  'sdk_updates.snoozed': {};
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
  'growth.onboarding_load_choose_platform':
    'Growth: Onboarding Load Choose Platform Page',
  'growth.onboarding_set_up_your_project': 'Growth: Onboarding Click Set Up Your Project',
  'growth.select_platform': 'Growth: Onboarding Choose Platform',
  'growth.platformpicker_category': 'Growth: Onboarding Platform Category',
  'growth.platformpicker_search': 'Growth: Onboarding Platform Search',
  'growth.onboarding_start_onboarding': 'Growth: Onboarding Start Onboarding',
  'growth.onboarding_clicked_skip': 'Growth: Onboarding Clicked Skip',
  'growth.onboarding_take_to_error': 'Growth: Onboarding Take to Error',
  'growth.onboarding_view_full_docs': 'Growth: Onboarding View Full Docs',
  'growth.onboarding_view_sample_event': 'Growth: Onboarding View Sample Event',
  'growth.onboarding_clicked_instrument_app': 'Growth: Onboarding Clicked Instrument App',
  'invite_request.approved': 'Invite Request Approved',
  'invite_request.denied': 'Invite Request Denied',
  'growth.demo_modal_clicked_signup': 'Growth: Demo Modal Clicked Signup',
  'growth.demo_modal_clicked_continue': 'Growth: Demo Modal Clicked Continue',
  'growth.clicked_enter_sandbox': 'Growth: Clicked Enter Sandbox',
  'growth.sample_transaction_docs_link_clicked':
    'Growth: Sample Transaction Docs Link Clicked',
  'growth.sample_error_onboarding_link_clicked':
    'Growth: Sample Error Onboarding Link Clicked',
  'growth.issue_open_in_discover_btn_clicked':
    'Growth: Open in Discover Button in Issue Details clicked',
  'member_settings_page.loaded': 'Member Settings Page Loaded',
  'invite_modal.opened': 'Invite Modal: Opened',
  'invite_modal.closed': 'Invite Modal: Closed',
  'invite_modal.add_more': 'Invite Modal: Add More',
  'invite_modal.invites_sent': 'Invite Modal: Invites Sent',
  'invite_modal.requests_sent': 'Invite Modal: Requests Sent',
  'sdk_updates.seen': 'SDK Updates: Seen',
  'sdk_updates.snoozed': 'SDK Updates: Snoozed',
  'sdk_updates.clicked': 'SDK Updates: Clicked',
};
