import {useEffect, useState} from 'react';

import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import {
  useFetchTransactions,
  useTransactionData,
} from 'sentry/views/replays/detail/trace/replayTransactionContext';

export interface ReplayTraceRow {
  durationMs: number;
  frameOpOrCategory: string | undefined;
  offsetMs: number;
  replayFrame: ReplayFrame;
  timestampMs: number;
  traces: TraceFullDetailed[];
}

interface Props {
  replay: ReplayReader | null;
}

export default function useReplayPerfData({replay}: Props) {
  const [data, setData] = useState<ReplayTraceRow[]>([]);

  const {
    state: {didInit: _didInit, errors: errors, isFetching: isFetching, traces = []},
    eventView,
  } = useTransactionData();

  useFetchTransactions();

  useEffect(() => {
    if (!replay) {
      return;
    }
    // const startTimestampMs = replay.getReplay().started_at.getTime();

    // Clone the list because we're going to mutate it
    const frames = [...replay.getPerfFrames()];

    const rows: ReplayTraceRow[] = [];

    while (frames.length) {
      const thisFrame = frames.shift()!;
      const nextFrame = frames[0];

      const tracesAfterThis = traces.filter(
        trace => trace.start_timestamp * 1000 >= thisFrame.timestampMs
      );

      rows.push({
        durationMs: nextFrame ? nextFrame.timestampMs - thisFrame.timestampMs : 0,
        frameOpOrCategory: getFrameOpOrCategory(thisFrame),
        offsetMs: thisFrame.offsetMs,
        replayFrame: thisFrame,
        timestampMs: thisFrame.timestampMs,
        traces: nextFrame
          ? tracesAfterThis.filter(
              trace => trace.start_timestamp * 1000 < nextFrame.timestampMs
            )
          : tracesAfterThis,
      });

      // const traces = ;

      // relatedTraces.forEach(trace => {
      //   const traceTimestampMS = trace.start_timestamp * 1000;
      //   rows.push({
      //     durationMs: trace['transaction.duration'],
      //     frameOpOrCategory: undefined,
      //     offsetMs: traceTimestampMS - startTimestampMs,
      //     timestampMs: traceTimestampMS,
      //     trace,
      //   });
      // });
    }

    setData(rows);
  }, [replay, traces]);

  return {
    data,
    errors,
    eventView,
    isFetching,
  };
}
