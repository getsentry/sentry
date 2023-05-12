import type {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import {Output} from 'sentry/views/replays/detail/network/details/getOutputType';

export type ReplayEventParameters = {
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
  'replay.details-tab-changed': {
    tab: string;
  };
  'replay.details-time-spent': {
    seconds: number;
    user_email: string;
  };
  'replay.details-viewed': {
    referrer: undefined | string;
    user_email: string;
  };
  // similar purpose as "replay.details-viewed", however we're capturing the navigation action
  // in order to also include a project platform
  'replay.list-navigate-to-details': {
    platform: string | undefined;
    project_id: string | undefined;
    referrer: string;
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
    play: boolean;
    user_email: string;
  };
  'replay.render-issues-detail-count': {
    count: number;
    platform: string;
    project_id: string;
  };
  'replay.render-issues-group-list': {
    platform: string | undefined;
    project_id: string | undefined;
  };
  'replay.render-player': {
    aspect_ratio: 'portrait' | 'landscape';
    /*
     * What scale is the video as a percent, bucketed into ranges of 10% increments
     * example:
     *  - The video is shown at 25% the normal size
     *  - in CSS we use the statement `transform: scale(0.25);`
     *  - The logged value is `20`, because the scale is in the range of 20% to 30%.
     */
    scale_bucket: 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;
  };
  'replay.search': {
    search_keys: string;
  };
  'replay.toggle-fullscreen': {
    fullscreen: boolean;
    user_email: string;
  };
};

export type ReplayEventKey = keyof ReplayEventParameters;

export const replayEventMap: Record<ReplayEventKey, string | null> = {
  'replay.details-layout-changed': 'Changed Replay Details Layout',
  'replay.details-network-panel-closed': 'Closed Replay Network Details Panel',
  'replay.details-network-panel-opened': 'Opened Replay Network Details Panel',
  'replay.details-network-tab-changed': 'Changed Replay Network Details Tab',
  'replay.details-resized-panel': 'Resized Replay Details Panel',
  'replay.details-tab-changed': 'Changed Replay Details Tab',
  'replay.details-time-spent': 'Time Spent Viewing Replay Details',
  'replay.details-viewed': 'Viewed Replay Details',
  'replay.list-navigate-to-details': 'Replays List Navigate to Replay Details',
  'replay.list-paginated': 'Paginated Replay List',
  'replay.list-sorted': 'Sorted Replay List',
  'replay.list-time-spent': 'Time Spent Viewing Replay List',
  'replay.list-view-setup-sidebar': 'Views Set Up Replays Sidebar',
  'replay.play-pause': 'Played/Paused Replay',
  'replay.render-issues-detail-count': 'Render Issues Detail Replay Count',
  'replay.render-issues-group-list': 'Render Issues Detail Replay List',
  'replay.render-player': 'Rendered ReplayPlayer',
  'replay.search': 'Searched Replay',
  'replay.toggle-fullscreen': 'Toggled Replay Fullscreen',
};
