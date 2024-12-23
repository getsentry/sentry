import {createContext, useContext, useMemo} from 'react';

import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {RecordingFrame, VideoEvent} from 'sentry/utils/replays/types';

type EventsTuple = [RecordingFrame[], VideoEvent[]];
const context = createContext<EventsTuple>([[], []]);

export function ReplayPlayerEventsContextProvider({
  children,
  replay,
}: {
  children: React.ReactNode;
  replay: ReplayReader;
}) {
  const events = useMemo(
    (): EventsTuple => [replay.getRRWebFrames(), replay.getVideoEvents()],
    [replay]
  );
  return <context.Provider value={events}>{children}</context.Provider>;
}

export function useReplayPlayerEvents() {
  return useContext(context);
}
