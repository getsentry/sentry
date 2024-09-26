import {createContext, useContext} from 'react';

import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {RecordingFrame} from 'sentry/utils/replays/types';

const context = createContext<RecordingFrame[]>([]);

export function ReplayPlayerEventsContextProvider({
  children,
  replay,
}: {
  children: React.ReactNode;
  replay: ReplayReader;
}) {
  return <context.Provider value={replay.getRRWebFrames()}>{children}</context.Provider>;
}

export function useReplayPlayerEvents() {
  return useContext(context);
}
