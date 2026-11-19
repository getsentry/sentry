import type {PlatformKey} from 'sentry/types/platform';

export type PlatformSelectionSource = 'detected' | 'manual';

type PlatformCategory = {
  category: string;
  source?: string;
  // For project creation, `source` identifies the flow and `variant` the experience.
  variant?: 'scm' | 'legacy';
};

type PlatformPickerParam = {
  platform_id: string;
  selection_source?: PlatformSelectionSource;
  source?: string;
  variant?: 'scm' | 'legacy';
};

type PlatformSearchParam = {
  num_results: number;
  search: string;
  source?: string;
  variant?: 'scm' | 'legacy';
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
  'github_invite_banner.snoozed': Record<string, unknown>;
  'github_invite_banner.viewed': {members_shown: number; total_members: number};
  'growth.clicked_enter_sandbox': {
    scenario?: string;
    source?: string;
    step?: string;
  };
  'growth.demo_click_docs': Record<string, unknown>;
  'growth.demo_click_request_demo': Record<string, unknown>;
  'growth.demo_click_sign_up': Record<string, unknown>;
  'growth.demo_email_submitted': Record<string, unknown>;
  'growth.demo_modal_clicked_close': Record<string, unknown>;
  'growth.demo_modal_clicked_demo': Record<string, unknown>;
  'growth.demo_modal_clicked_signup': Record<string, unknown>;
  'growth.end_modal_close': Record<string, unknown>;
  'growth.end_modal_more_tours': Record<string, unknown>;
  'growth.end_modal_restart_tours': Record<string, unknown>;
  'growth.end_modal_signup': Record<string, unknown>;
  'growth.onboarding_take_to_error': {
    platform?: string;
  };
  'growth.onboarding_view_sample_event': SampleEventParam;
  'growth.platformpicker_category': PlatformCategory;
  'growth.platformpicker_search': PlatformSearchParam;
  'growth.sample_error_onboarding_link_clicked': {
    platform?: string;
    project_id?: string;
  };
  'growth.select_platform': PlatformPickerParam;
  'invite_modal.add_more': InviteModal;
  'invite_modal.invites_sent': InviteModal;
  'invite_modal.opened': InviteModal & {
    can_invite: boolean;
    source?: string;
  };
  'invite_modal.requests_sent': InviteModal;
  'invite_request.approved': InviteRequestParam;
  'invite_request.denied': InviteRequestParam;
  'sample_event.button_viewed': {
    project_id: string;
    source: string;
  };
  'sample_event.created': SampleEvent;
  'sample_event.failed': SampleEvent;
};

type GrowthAnalyticsKey = keyof GrowthEventParameters;

export const growthEventMap: Record<GrowthAnalyticsKey, string | null> = {
  'assistant.guide_finished': 'Assistant Guide Finished',
  'assistant.guide_dismissed': 'Assistant Guide Dismissed',
  'github_invite_banner.snoozed': 'Github Invite Banner Snoozed',
  'github_invite_banner.viewed': 'Github Invite Banner Viewed',
  'growth.demo_click_sign_up': 'Growth: Demo Click Sign Up',
  'growth.demo_click_docs': 'Growth: Demo Click Docs',
  'growth.demo_click_request_demo': 'Growth: Demo Click Request Demo',
  'growth.demo_email_submitted': 'Sandbox: Demo Email Submitted',
  'growth.select_platform': 'Growth: Onboarding Choose Platform',
  'growth.platformpicker_category': 'Growth: Onboarding Platform Category',
  'growth.platformpicker_search': 'Growth: Onboarding Platform Search',
  'growth.onboarding_take_to_error': 'Growth: Onboarding Take to Error',
  'growth.onboarding_view_sample_event': 'Growth: Onboarding View Sample Event',
  'invite_request.approved': 'Invite Request Approved',
  'invite_request.denied': 'Invite Request Denied',
  'growth.demo_modal_clicked_signup': 'Growth: Demo Modal Clicked Signup',
  'growth.demo_modal_clicked_close': 'Growth: Demo Modal Clicked Close',
  'growth.demo_modal_clicked_demo': 'Growth: Demo Modal Clicked Demo',
  'growth.clicked_enter_sandbox': 'Growth: Clicked Enter Sandbox',
  'growth.sample_error_onboarding_link_clicked':
    'Growth: Sample Error Onboarding Link Clicked',
  'invite_modal.opened': 'Invite Modal: Opened',
  'invite_modal.add_more': 'Invite Modal: Add More',
  'invite_modal.invites_sent': 'Invite Modal: Invites Sent',
  'invite_modal.requests_sent': 'Invite Modal: Requests Sent',
  'sample_event.button_viewed': null, // high-volume event
  'sample_event.created': 'Sample Event Created',
  'sample_event.failed': 'Sample Event Failed',
  'assistant.guide_cued': 'Assistant Guide Cued',
  'growth.end_modal_more_tours': 'Growth: End Modal More Tours',
  'growth.end_modal_restart_tours': 'Growth: End Modal Restart Tours',
  'growth.end_modal_close': 'Growth: End Modal Close',
  'growth.end_modal_signup': 'Growth: End Modal Signup',
};
