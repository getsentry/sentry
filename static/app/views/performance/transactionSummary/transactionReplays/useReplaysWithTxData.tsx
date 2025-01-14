import type {EventSpanData} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysFromTransaction';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Opts = {
  events: EventSpanData[];
  replays: undefined | ReplayListRecord[];
};

export type ReplayListRecordWithTx = ReplayListRecord & {
  txEvent: {[x: string]: any};
};

type Return = undefined | ReplayListRecordWithTx[];

function useReplaysWithTxData({events, replays}: Opts): Return {
  const replaysWithTx = replays?.map<ReplayListRecordWithTx>(replay => {
    const slowestEvent = events.reduce((slowest, event) => {
      if (event.replayId !== replay.id) {
        return slowest;
      }
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (!slowest['transaction.duration']) {
        return event;
      }
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return event['transaction.duration'] > slowest['transaction.duration']
        ? event
        : slowest;
    }, {});

    return {
      ...replay,
      txEvent: slowestEvent ?? {},
    };
  });

  return replaysWithTx;
}

export default useReplaysWithTxData;
