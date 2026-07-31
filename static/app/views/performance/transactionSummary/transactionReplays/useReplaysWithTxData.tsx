import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

interface SpanEvent {
  [key: string]: unknown;
  replayId: string;
  'span.duration': number;
}

export type ReplayListRecordWithTx = ReplayListRecord & {
  txEvent: Record<string, any>;
};

type Return = undefined | ReplayListRecordWithTx[];

export function useReplaysWithTxData({
  events,
  replays,
}: {
  events: SpanEvent[];
  replays: undefined | ReplayListRecord[];
}): Return {
  const replaysWithTx = replays?.map<ReplayListRecordWithTx>(replay => {
    const slowestEvent = events.reduce<SpanEvent | undefined>((slowest, event) => {
      if (event.replayId !== replay.id) {
        return slowest;
      }
      if (!slowest?.['span.duration']) {
        return event;
      }
      return event['span.duration'] > slowest['span.duration'] ? event : slowest;
    }, undefined);

    const txEvent: Record<string, any> = slowestEvent ?? {};

    return {
      ...replay,
      txEvent,
    };
  });

  return replaysWithTx;
}
