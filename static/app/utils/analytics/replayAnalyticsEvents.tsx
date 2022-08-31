export type ReplayEventParameters = {
  'replay-details.viewed': {
    origin: undefined | string;
    user_email: string;
  };
};

export type ReplayEventKey = keyof ReplayEventParameters;

export const replayEventMap: Record<ReplayEventKey, string | null> = {
  'replay-details.viewed': 'Viewed Replay Details',
};
