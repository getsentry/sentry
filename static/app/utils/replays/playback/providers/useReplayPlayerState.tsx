import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';
import type {Replayer} from '@sentry-internal/rrweb';

type Context = {
  isFinished: boolean;
  playerState: 'playing' | 'paused' | 'live';
  replayers: Replayer[];
  startTimeOffsetMs: number;
};

const ReplayPlayerStateContext = createContext<Context>({
  isFinished: false,
  playerState: 'paused',
  replayers: [],
  startTimeOffsetMs: 0,
});

export function ReplayPlayerStateFromContextProvider({
  children,
  isFinished,
  isPlaying,
  replayer,
  startTimeOffsetMs,
}: {
  children: ReactNode;
  isFinished: boolean;
  isPlaying: boolean;
  replayer: Replayer | undefined;
  startTimeOffsetMs: number;
}) {
  return (
    <ReplayPlayerStateContext.Provider
      value={{
        isFinished,
        playerState: isPlaying ? 'playing' : 'paused',
        replayers: replayer ? [replayer] : [],
        startTimeOffsetMs,
      }}
    >
      {children}
    </ReplayPlayerStateContext.Provider>
  );
}

export default function useReplayPlayerState() {
  return useContext(ReplayPlayerStateContext);
}
