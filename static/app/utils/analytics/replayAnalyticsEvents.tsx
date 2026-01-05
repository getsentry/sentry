import type {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import type {Output} from 'sentry/views/replays/detail/network/details/getOutputType';

export type ReplayEventParameters = {
  'replay.ai-summary.chapter-clicked': {
    chapter_type?: 'error' | 'feedback';
  };
  'replay.ai-summary.regenerate-requested': {
    area: string;
  };
  'replay.ai_tab_shown': Record<string, unknown>;
  'replay.canvas-detected-banner-clicked': {
    sdk_needs_update?: boolean;
  };
  'replay.details-data-loaded': {
    be_errors: number;
    fe_errors: number;
    finished_at_delta: number; // Log the change (positive number==later date) in finished_at
    project_platform: string;
    replay_errors: number;
    replay_id: string;
    started_at_delta: number; // Log the change (negative number==earlier date) in started_at
    total_errors: number;
  };
  'replay.details-has-hydration-error': {
    num_errors: number;
    replay_id: string;
  };
  'replay.details-layout-changed': {
    chosen_layout: LayoutKey;
    default_layout: LayoutKey;
  };
  'replay.details-network-panel-closed': {
    is_sdk_setup: boolean;
  };
  'replay.details-network-panel-opened': {
    is_sdk_setup: boolean;
    resource_method: string;
    resource_status: string;
    resource_type: string;
  };
  'replay.details-network-tab-changed': {
    is_sdk_setup: boolean;
    output: Output;
    resource_method: string;
    resource_status: string;
    resource_type: string;
    tab: string;
  };
  'replay.details-playlist-clicked': {
    direction: 'previous' | 'next';
  };
  'replay.details-refresh-clicked': Record<string, unknown>;
  'replay.details-resized-panel': {
    layout: LayoutKey;
    slide_motion: 'toTop' | 'toBottom' | 'toLeft' | 'toRight';
  };
  'replay.details-resource-docs-clicked': {
    title: string;
  };
  'replay.details-tab-changed': {
    mobile: boolean;
    tab: string;
  };
  'replay.details-time-spent': {
    seconds: number;
    user_email: string;
  };
  'replay.details-timestamp-button-clicked': {
    area: string;
  };

  'replay.frame-after-background': {
    frame: string;
  };
  'replay.gaps_detected': {
    gaps: number;
    max_gap: number;
    replay_duration: number;
  };
  'replay.hydration-error.issue-details-opened': Record<string, unknown>;
  'replay.hydration-modal.slider-interaction': Record<string, unknown>;

  'replay.hydration-modal.tab-change': {
    tabKey: string;
  };
  // similar purpose as "replay.details-viewed", however we're capturing the navigation action
  // in order to also include a project platform
  'replay.list-navigate-to-details': {
    platform: string | undefined;
    project_id: string | undefined;
    referrer: string;
    referrer_table?: 'main' | 'selector-widget' | 'details';
  };
  'replay.list-paginated': {
    direction: 'next' | 'prev';
  };
  'replay.list-sorted': {
    column: string;
  };
  'replay.list-time-spent': {
    seconds: number;
    user_email: string;
  };
  'replay.list-view-setup-sidebar': Record<string, unknown>;
  'replay.play-pause': {
    context: string;
    mobile: boolean;
    play: boolean;
    user_email: string;
  };
  'replay.rage-click-sdk-banner.dismissed': {
    surface: string;
  };
  'replay.rage-click-sdk-banner.rendered': {
    is_dismissed: boolean;
    surface: string;
  };
  'replay.render-issues-group-list': {
    platform: string | undefined;
    project_id: string | undefined;
  };
  'replay.render-missing-replay-alert': {
    surface: string;
  };
  'replay.search': {
    search_keys: string;
  };
  'replay.timeline.zoom-in': Record<string, unknown>;
  'replay.timeline.zoom-out': Record<string, unknown>;
  'replay.toggle-fullscreen': {
    context: string;
    fullscreen: boolean;
    user_email: string;
  };
  'replay.view-html': {
    breadcrumb_type: string;
  };
};

type ReplayEventKey = keyof ReplayEventParameters;

export const replayEventMap: Record<ReplayEventKey, string | null> = {
  'replay.ai_tab_shown': 'Replay AI Tab Shown',
  'replay.ai-summary.chapter-clicked': 'Clicked Replay AI Summary Chapter',
  'replay.ai-summary.regenerate-requested': 'Requested to Regenerate Replay AI Summary',
  'replay.canvas-detected-banner-clicked': 'Clicked Canvas Detected in Replay Banner',
  'replay.details-refresh-clicked': 'Clicked Refresh Button in Replay Details',
  'replay.details-playlist-clicked': 'Clicked Replay Playlist Button in Replay Details',
  'replay.details-data-loaded': 'Replay Details Data Loaded',
  'replay.details-has-hydration-error': 'Replay Details Has Hydration Error',
  'replay.details-layout-changed': 'Changed Replay Details Layout',
  'replay.details-network-panel-closed': 'Closed Replay Network Details Panel',
  'replay.details-network-panel-opened': 'Opened Replay Network Details Panel',
  'replay.details-network-tab-changed': 'Changed Replay Network Details Tab',
  'replay.details-resized-panel': 'Resized Replay Details Panel',
  'replay.details-resource-docs-clicked': 'Replay Details Resource Docs Clicked',
  'replay.details-tab-changed': 'Changed Replay Details Tab',
  'replay.details-time-spent': 'Time Spent Viewing Replay Details',
  'replay.details-timestamp-button-clicked': 'Clicked Timestamp in Replay Details',
  'replay.frame-after-background': 'Replay Frame Following Background Frame',
  'replay.hydration-error.issue-details-opened': 'Hydration Issue Details Opened',
  'replay.hydration-modal.slider-interaction': 'Hydration Modal Slider Clicked',
  'replay.hydration-modal.tab-change': 'Hydration Modal Tab Changed',
  'replay.list-navigate-to-details': 'Replays List Navigate to Replay Details',
  'replay.list-paginated': 'Paginated Replay List',
  'replay.list-sorted': 'Sorted Replay List',
  'replay.list-time-spent': 'Time Spent Viewing Replay List',
  'replay.list-view-setup-sidebar': 'Views Set Up Replays Sidebar',
  'replay.gaps_detected': 'Number of Gaps in Replay Timeline',
  'replay.play-pause': 'Played/Paused Replay',
  'replay.rage-click-sdk-banner.dismissed': 'Replay Rage Click SDK Banner Dismissed',
  'replay.rage-click-sdk-banner.rendered': 'Replay Rage Click SDK Banner Rendered',
  'replay.render-issues-group-list': 'Render Issues Detail Replay List',
  'replay.render-missing-replay-alert': 'Render Missing Replay Alert',
  'replay.search': 'Searched Replay',
  'replay.timeline.zoom-in': 'Zoomed In Replay Timeline',
  'replay.timeline.zoom-out': 'Zoomed Out Replay Timeline',
  'replay.toggle-fullscreen': 'Toggled Replay Fullscreen',
  'replay.view-html': 'Clicked "View HTML" in Replay Breadcrumb',
};
