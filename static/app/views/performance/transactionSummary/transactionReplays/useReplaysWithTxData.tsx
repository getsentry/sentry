import {EventSpanData} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysFromTransaction';
import {ReplayListRecord} from 'sentry/views/replays/types';

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
      if (!slowest['transaction.duration']) {
        return event;
      }
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
