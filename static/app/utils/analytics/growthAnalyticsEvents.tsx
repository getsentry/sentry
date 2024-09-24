import type {PlatformKey} from 'sentry/types/project';

type MobilePromptBannerParams = {
  matchedUserAgentString: string;
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

type SampleEvent = {
  duration: number;
  interval: number;
  platform: string;
  project_id: string;
  retries: number;
  source: string;
};

type SetupWizard = {
  project_platform?: string;
};

// define the event key to payload mappings
export type GrowthEventParameters = {
  'assistant.guide_cued': {
    guide: string;
  };
  'assistant.guide_dismissed': {
    guide: string;
    step: number;
  };
  'assistant.guide_finished': {
    guide: string;
  };
  'github_invite_banner.snoozed': {};
  'github_invite_banner.viewed': {members_shown: number; total_members: number};
  'growth.clicked_enter_sandbox': {
    scenario: string;
    source?: string;
  };
  'growth.clicked_mobile_prompt_ask_teammate': MobilePromptBannerParams;
  'growth.clicked_mobile_prompt_setup_project': MobilePromptBannerParams;
  'growth.clicked_sidebar': {
    item: string;
  };
  'growth.demo_click_docs': {};
  'growth.demo_click_get_started': {cta?: string};
  'growth.demo_click_request_demo': {};
  'growth.demo_modal_clicked_close': {};
  'growth.demo_modal_clicked_continue': {};
  'growth.demo_modal_clicked_demo': {};
  'growth.demo_modal_clicked_signup': {};
  'growth.end_modal_close': {};
  'growth.end_modal_more_tours': {};
  'growth.end_modal_restart_tours': {};
  'growth.end_modal_signup': {};
  'growth.metric_alert_preset_sidebar_clicked': {
    preset: string;
  };
  'growth.metric_alert_preset_use_template': {
    preset: string;
  };
  'growth.onboarding_clicked_instrument_app': {source?: string};
  'growth.onboarding_clicked_setup_platform_later': PlatformParam & {
    project_id: string;
  };
  'growth.onboarding_clicked_skip': {source?: string};
  'growth.onboarding_load_choose_platform': {};
  'growth.onboarding_quick_start_cta': SampleEventParam;
  'growth.onboarding_set_up_your_project': PlatformParam;
  'growth.onboarding_start_onboarding': {
    source?: string;
  };
  'growth.onboarding_take_to_error': {
    platform?: string;
  };
  'growth.onboarding_view_full_docs': {};
  'growth.onboarding_view_sample_event': SampleEventParam;
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
  'onboarding.wizard_clicked': {
    action: string;
    todo_id: string;
    todo_title: string;
  };
  'onboarding.wizard_opened': {};
  'sample_event.button_viewed': {
    project_id: string;
    source: string;
  };
  'sample_event.created': SampleEvent;
  'sample_event.failed': SampleEvent;
  'sdk_updates.clicked': {};
  'sdk_updates.seen': {};
  'sdk_updates.snoozed': {};
  'setup_wizard.clicked_viewed_docs': SetupWizard;
  'setup_wizard.clicked_viewed_issues': SetupWizard;
  'setup_wizard.complete': SetupWizard;
  'setup_wizard.viewed': SetupWizard;
};

type GrowthAnalyticsKey = keyof GrowthEventParameters;

export const growthEventMap: Record<GrowthAnalyticsKey, string | null> = {
  'assistant.guide_finished': 'Assistant Guide Finished',
  'assistant.guide_dismissed': 'Assistant Guide Dismissed',
  'github_invite_banner.snoozed': 'Github Invite Banner Snoozed',
  'github_invite_banner.viewed': 'Github Invite Banner Viewed',
  'growth.clicked_mobile_prompt_setup_project':
    'Growth: Clicked Mobile Prompt Setup Project',
  'growth.clicked_mobile_prompt_ask_teammate':
    'Growth: Clicked Mobile Prompt Ask Teammate',
  'growth.submitted_mobile_prompt_ask_teammate':
    'Growth: Submitted Mobile Prompt Ask Teammate',
  'growth.demo_click_get_started': 'Growth: Demo Click Get Started',
  'growth.demo_click_docs': 'Growth: Demo Click Docs',
  'growth.demo_click_request_demo': 'Growth: Demo Click Request Demo',
  'growth.clicked_sidebar': 'Growth: Clicked Sidebar',
  'growth.onboarding_load_choose_platform':
    'Growth: Onboarding Load Choose Platform Page',
  'growth.onboarding_set_up_your_project': 'Growth: Onboarding Click Set Up Your Project',
  'growth.select_platform': 'Growth: Onboarding Choose Platform',
  'growth.platformpicker_category': 'Growth: Onboarding Platform Category',
  'growth.platformpicker_search': 'Growth: Onboarding Platform Search',
  'growth.metric_alert_preset_use_template': 'Growth: Metric Alert Preset Use Template',
  'growth.metric_alert_preset_sidebar_clicked':
    'Growth: Metric Alert Preset Sidebar Clicked',
  'growth.onboarding_start_onboarding': 'Growth: Onboarding Start Onboarding',
  'growth.onboarding_clicked_skip': 'Growth: Onboarding Clicked Skip',
  'growth.onboarding_take_to_error': 'Growth: Onboarding Take to Error',
  'growth.onboarding_view_full_docs': 'Growth: Onboarding View Full Docs',
  'growth.onboarding_view_sample_event': 'Growth: Onboarding View Sample Event',
  'growth.onboarding_clicked_instrument_app': 'Growth: Onboarding Clicked Instrument App',
  'growth.onboarding_clicked_setup_platform_later':
    'Growth: Onboarding Clicked Setup Platform Later',
  'growth.onboarding_quick_start_cta': 'Growth: Quick Start Onboarding CTA',
  'invite_request.approved': 'Invite Request Approved',
  'invite_request.denied': 'Invite Request Denied',
  'growth.demo_modal_clicked_signup': 'Growth: Demo Modal Clicked Signup',
  'growth.demo_modal_clicked_continue': 'Growth: Demo Modal Clicked Continue',
  'growth.demo_modal_clicked_close': 'Growth: Demo Modal Clicked Close',
  'growth.demo_modal_clicked_demo': 'Growth: Demo Modal Clicked Demo',
  'growth.clicked_enter_sandbox': 'Growth: Clicked Enter Sandbox',
  'growth.sample_transaction_docs_link_clicked':
    'Growth: Sample Transaction Docs Link Clicked',
  'growth.sample_error_onboarding_link_clicked':
    'Growth: Sample Error Onboarding Link Clicked',
  'member_settings_page.loaded': 'Member Settings Page Loaded',
  'invite_modal.opened': 'Invite Modal: Opened',
  'invite_modal.closed': 'Invite Modal: Closed',
  'invite_modal.add_more': 'Invite Modal: Add More',
  'invite_modal.invites_sent': 'Invite Modal: Invites Sent',
  'invite_modal.requests_sent': 'Invite Modal: Requests Sent',
  'sdk_updates.seen': 'SDK Updates: Seen',
  'sdk_updates.snoozed': 'SDK Updates: Snoozed',
  'sdk_updates.clicked': 'SDK Updates: Clicked',
  'onboarding.wizard_opened': 'Onboarding Wizard Opened',
  'onboarding.wizard_clicked': 'Onboarding Wizard Clicked',
  'sample_event.button_viewed': null, // high-volume event
  'sample_event.created': 'Sample Event Created',
  'sample_event.failed': 'Sample Event Failed',
  'assistant.guide_cued': 'Assistant Guide Cued',
  'growth.end_modal_more_tours': 'Growth: End Modal More Tours',
  'growth.end_modal_restart_tours': 'Growth: End Modal Restart Tours',
  'growth.end_modal_close': 'Growth: End Modal Close',
  'growth.end_modal_signup': 'Growth: End Modal Signup',
  'setup_wizard.viewed': 'Setup Wizard: Viewed',
  'setup_wizard.complete': 'Setup Wizard: Complete',
  'setup_wizard.clicked_viewed_issues': 'Setup Wizard: Clicked Viewed Issues',
  'setup_wizard.clicked_viewed_docs': 'SetupW izard: Clicked Viewed Docs',
};
