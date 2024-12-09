import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from 'react';

import ReplayReader from 'sentry/utils/replays/replayReader';

type ContextType = {
  leftOffsetMs: number;
  leftTimestampMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
  rightTimestampMs: number;
  setLeftOffsetMs: Dispatch<SetStateAction<number>>;
  setRightOffsetMs: Dispatch<SetStateAction<number>>;
};

const context = createContext<ContextType>({
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
  initialLeftOffsetMs: number;
  initialRightOffsetMs: number;
  replay: ReplayReader;
  children?: ReactNode;
}

export function DiffCompareContextProvider({
  replay,
  initialLeftOffsetMs,
  initialRightOffsetMs,
  children,
}: Props) {
  const [leftOffsetMs, setLeftOffsetMs] = useState(initialLeftOffsetMs);
  const [rightOffsetMs, setRightOffsetMs] = useState(initialRightOffsetMs);

  const startTimestampMs = replay.getReplay().started_at.getTime() ?? 0;
  const leftTimestampMs = startTimestampMs + leftOffsetMs;
  const rightTimestampMs = startTimestampMs + rightOffsetMs;

  return (
    <context.Provider
      value={{
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
