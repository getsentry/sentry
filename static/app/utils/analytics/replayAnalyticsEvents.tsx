import type {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';

export type ReplayEventParameters = {
  'replay-details.layout-changed': {
    chosen_layout: LayoutKey;
    default_layout: LayoutKey;
  };
  'replay-details.resized-panel': {
    layout: LayoutKey;
    slide_motion: 'toTop' | 'toBottom' | 'toLeft' | 'toRight';
  };
  'replay-details.viewed': {
    origin: undefined | string;
    user_email: string;
  };
};

export type ReplayEventKey = keyof ReplayEventParameters;

export const replayEventMap: Record<ReplayEventKey, string | null> = {
  'replay-details.layout-changed': 'Changed Replay Details Layout',
  'replay-details.resized-panel': 'Resized Replay Details Panel',
  'replay-details.viewed': 'Viewed Replay Details',
};
