import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from 'react';

import type {Event} from 'sentry/types/event';
import ReplayReader from 'sentry/utils/replays/replayReader';
import type {HydrationErrorFrame} from 'sentry/utils/replays/types';

type ContextType = {
  frameOrEvent: HydrationErrorFrame | Event;
  leftOffsetMs: number;
  leftTimestampMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
  rightTimestampMs: number;
  setLeftOffsetMs: Dispatch<SetStateAction<number>>;
  setRightOffsetMs: Dispatch<SetStateAction<number>>;
};

const context = createContext<ContextType>({
  frameOrEvent: {} as Event,
  replay: ReplayReader.factory({
    attachments: [],
    errors: [],
    fetching: false,
    replayRecord: undefined,
  })!,
  leftOffsetMs: 0,
  leftTimestampMs: 0,
  rightOffsetMs: 0,
  rightTimestampMs: 0,
  setLeftOffsetMs: () => {},
  setRightOffsetMs: () => {},
});

export function useDiffCompareContext() {
  return useContext(context);
}

interface Props {
  frameOrEvent: HydrationErrorFrame | Event;
  initialLeftOffsetMs: number;
  initialRightOffsetMs: number;
  replay: ReplayReader;
  children?: ReactNode;
}

export function DiffCompareContextProvider({
  children,
  frameOrEvent,
  initialLeftOffsetMs,
  initialRightOffsetMs,
  replay,
}: Props) {
  const [leftOffsetMs, setLeftOffsetMs] = useState(initialLeftOffsetMs);
  const [rightOffsetMs, setRightOffsetMs] = useState(initialRightOffsetMs);

  const startTimestampMs = replay.getReplay().started_at.getTime() ?? 0;
  const leftTimestampMs = startTimestampMs + leftOffsetMs;
  const rightTimestampMs = startTimestampMs + rightOffsetMs;

  return (
    <context.Provider
      value={{
        frameOrEvent,
        leftOffsetMs,
        leftTimestampMs,
        replay,
        rightOffsetMs,
        rightTimestampMs,
        setLeftOffsetMs,
        setRightOffsetMs,
      }}
    >
      {children}
    </context.Provider>
  );
}
