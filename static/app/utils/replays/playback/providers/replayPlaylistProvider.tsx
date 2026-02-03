import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';

import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  currentReplay: ReplayListRecord | undefined;
  isLoading: boolean;
  replays: ReplayListRecord[];
  pageLinks?: string | null;
}

const Context = createContext<{
  currentReplayIndex: number;
  isLoading: boolean;
  pageLinks: string | null;
  replays: ReplayListRecord[];
}>({currentReplayIndex: -1, replays: [], isLoading: false, pageLinks: null});

export function ReplayPlaylistProvider({
  children,
  currentReplay,
  isLoading,
  pageLinks = null,
  replays,
}: Props) {
  const currentReplayIndex = useMemo(
    () => replays?.findIndex(r => r.id === currentReplay?.id) ?? -1,
    [replays, currentReplay]
  );
  return (
    <Context value={{replays, currentReplayIndex, isLoading, pageLinks}}>
      {children}
    </Context>
  );
}

export function useReplayPlaylist() {
  return useContext(Context);
}
