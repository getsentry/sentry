import type {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';

export type ReplayEventParameters = {
  'replay.details-layout-changed': {
    chosen_layout: LayoutKey;
    default_layout: LayoutKey;
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
  'replay.play-pause': {
    play: boolean;
    user_email: string;
  };
  'replay.toggle-fullscreen': {
    fullscreen: boolean;
    user_email: string;
  };
};

export type ReplayEventKey = keyof ReplayEventParameters;

export const replayEventMap: Record<ReplayEventKey, string | null> = {
  'replay.details-layout-changed': 'Changed Replay Details Layout',
  'replay.details-resized-panel': 'Resized Replay Details Panel',
  'replay.details-tab-changed': 'Changed Replay Details Tab',
  'replay.details-time-spent': 'Time Spent Viewing Replay Details',
  'replay.details-viewed': 'Viewed Replay Details',
  'replay.play-pause': 'Played/Paused Replay',
  'replay.toggle-fullscreen': 'Toggled Replay Fullscreen',
};
