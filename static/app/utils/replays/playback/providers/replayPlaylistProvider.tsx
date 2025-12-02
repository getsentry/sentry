import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';

import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  currentReplay: ReplayListRecord | undefined;
  isLoading: boolean;
  replays: ReplayListRecord[];
}

const Context = createContext<{
  currentReplayIndex: number;
  isLoading: boolean;
  replays: ReplayListRecord[];
}>({currentReplayIndex: -1, replays: [], isLoading: false});

export function ReplayPlaylistProvider({
  children,
  currentReplay,
  isLoading,
  replays,
}: Props) {
  const currentReplayIndex = useMemo(
    () => replays?.findIndex(r => r.id === currentReplay?.id) ?? -1,
    [replays, currentReplay]
  );
  return <Context value={{replays, currentReplayIndex, isLoading}}>{children}</Context>;
}

export function useReplayPlaylist() {
  return useContext(Context);
}
