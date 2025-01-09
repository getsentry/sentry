import type {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import type {Output} from 'sentry/views/replays/detail/network/details/getOutputType';
import type {ReferrerTableType} from 'sentry/views/replays/replayTable/tableCell';

export type ReplayEventParameters = {
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
  'replay.frame-after-background': {
    frame: string;
  };

  'replay.gaps_detected': {
    gaps: number;
    max_gap: number;
    replay_duration: number;
  };
  'replay.hydration-error.issue-details-opened': {};
  'replay.hydration-modal.slider-interaction': {};
  'replay.hydration-modal.tab-change': {
    tabKey: string;
  };

  // similar purpose as "replay.details-viewed", however we're capturing the navigation action
  // in order to also include a project platform
  'replay.list-navigate-to-details': {
    platform: string | undefined;
    project_id: string | undefined;
    referrer: string;
    referrer_table?: ReferrerTableType;
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
  'replay.list-view-setup-sidebar': {};
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
  'replay.render-player': {
    aspect_ratio: 'portrait' | 'landscape';
    context: string;
    // What scale is the video as a percent, bucketed into ranges of 10% increments
    // example:
    //  - The video is shown at 25% the normal size
    //  - in CSS we use the statement `transform: scale(0.25);`
    //  - The logged value is `20`, because the scale is in the range of 20% to 30%.
    scale_bucket: 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;
  };
  'replay.search': {
    search_keys: string;
  };
  'replay.toggle-fullscreen': {
    context: string;
    fullscreen: boolean;
    user_email: string;
  };
};

export type ReplayEventKey = keyof ReplayEventParameters;

export const replayEventMap: Record<ReplayEventKey, string | null> = {
  'replay.canvas-detected-banner-clicked': 'Clicked Canvas Detected in Replay Banner',
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
  'replay.render-player': 'Rendered ReplayPlayer',
  'replay.search': 'Searched Replay',
  'replay.toggle-fullscreen': 'Toggled Replay Fullscreen',
};
