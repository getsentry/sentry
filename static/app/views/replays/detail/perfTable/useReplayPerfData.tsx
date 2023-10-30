import {useEffect, useState} from 'react';

import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {
  LargestContentfulPaintFrame,
  PaintFrame,
  ReplayFrame,
} from 'sentry/utils/replays/types';
import {
  useFetchTransactions,
  useTransactionData,
} from 'sentry/views/replays/detail/trace/replayTransactionContext';

interface IndentedTraceDetailed {
  indent: number;
  trace: TraceFullDetailed;
}

export type FlattenedTrace = IndentedTraceDetailed[];

export interface ReplayTraceRow {
  durationMs: number;
  flattenedTraces: FlattenedTrace[];
  lcpFrames: LargestContentfulPaintFrame[];
  offsetMs: number;
  paintFrames: PaintFrame[];
  replayFrame: ReplayFrame;
  timestampMs: number;
  traces: TraceFullDetailed[];
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
  const [data, setData] = useState<Map<ReplayFrame, ReplayTraceRow>>(new Map());

  const {
    state: {didInit: _didInit, errors: errors, isFetching: isFetching, traces = []},
    eventView: _eventView,
  } = useTransactionData();

  useFetchTransactions();

  useEffect(() => {
    if (!replay) {
      return;
    }

    const collection = new Map<ReplayFrame, ReplayTraceRow>();
    const frames = replay.getChapterFrames();

    frames.forEach((thisFrame, i) => {
      const nextFrame = frames[i + 1] as ReplayFrame | undefined;

      const isWithinThisAndNextFrame = (frame: ReplayFrame) => {
        return (
          frame.timestampMs > thisFrame.timestampMs &&
          (nextFrame === undefined || frame.timestampMs < nextFrame.timestampMs)
        );
      };

      const lcpFrames = replay.getLPCFrames().filter(isWithinThisAndNextFrame);
      const paintFrames = replay.getPaintFrames().filter(isWithinThisAndNextFrame);

      const tracesAfterThis = traces.filter(
        trace => trace.timestamp * 1000 >= thisFrame.timestampMs
      );

      const relatedTraces = nextFrame
        ? tracesAfterThis.filter(trace => trace.timestamp * 1000 < nextFrame.timestampMs)
        : tracesAfterThis;
      const flattenedTraces = relatedTraces.map(trace => mapTraces(0, [trace]));

      collection.set(thisFrame, {
        durationMs: nextFrame ? nextFrame.timestampMs - thisFrame.timestampMs : 0,
        lcpFrames,
        offsetMs: thisFrame.offsetMs,
        paintFrames,
        replayFrame: thisFrame,
        timestampMs: thisFrame.timestampMs,
        traces: relatedTraces,
        flattenedTraces,
      });
    });

    setData(collection);
  }, [replay, traces]);

  return {
    data,
    errors,
    isFetching,
  };
}
