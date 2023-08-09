import {useEffect, useState} from 'react';

import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {
  LargestContentfulPaintFrame,
  PaintFrame,
  ReplayFrame,
} from 'sentry/utils/replays/types';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import {
  useFetchTransactions,
  useTransactionData,
} from 'sentry/views/replays/detail/trace/replayTransactionContext';

export interface ReplayTraceRow {
  durationMs: number;
  frameOpOrCategory: string | undefined;
  lcpFrame: undefined | LargestContentfulPaintFrame;
  offsetMs: number;
  paintFrames: PaintFrame[];
  replayFrame: ReplayFrame;
  timestampMs: number;
  traces: TraceFullDetailed[];
  tracesFlattened: {indent: number; trace: TraceFullDetailed}[];
}

interface Props {
  replay: ReplayReader | null;
}

function mapTraces(indent: number, traces: TraceFullDetailed[]) {
  return traces.flatMap(trace => {
    return [
      {
        indent,
        trace,
      },
      ...mapTraces(indent + 1, trace.children),
    ];
  });
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

    // Clone the list because we're going to mutate it
    const frames = [...replay.getPerfFrames()];

    const rows: ReplayTraceRow[] = [];

    while (frames.length) {
      const thisFrame = frames.shift()!;

      const relatedOps = ['largest-contentful-paint', 'paint'];
      const relatedFrames: ReplayFrame[] = [];
      for (const frame of frames) {
        if (relatedOps.includes(getFrameOpOrCategory(frame))) {
          relatedFrames.push(frame);
        } else {
          break;
        }
      }
      for (let i = relatedFrames.length; i > 0; i--) {
        frames.shift();
      }

      const lcpFrame: undefined | LargestContentfulPaintFrame = relatedFrames.find(
        frame => getFrameOpOrCategory(frame) === 'largest-contentful-paint'
      ) as undefined | LargestContentfulPaintFrame;
      const paintFrames = relatedFrames.filter(
        frame => getFrameOpOrCategory(frame) === 'paint'
      ) as PaintFrame[];

      const nextFrame = frames[0];

      const tracesAfterThis = traces.filter(
        trace => trace.start_timestamp * 1000 >= thisFrame.timestampMs
      );

      const relatedTraces = nextFrame
        ? tracesAfterThis.filter(
            trace => trace.start_timestamp * 1000 < nextFrame.timestampMs
          )
        : tracesAfterThis;
      const tracesFlattened = mapTraces(0, relatedTraces);

      rows.push({
        durationMs: nextFrame ? nextFrame.timestampMs - thisFrame.timestampMs : 0,
        frameOpOrCategory: getFrameOpOrCategory(thisFrame),
        lcpFrame,
        offsetMs: thisFrame.offsetMs,
        paintFrames,
        replayFrame: thisFrame,
        timestampMs: thisFrame.timestampMs,
        traces: relatedTraces,
        tracesFlattened,
      });
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
