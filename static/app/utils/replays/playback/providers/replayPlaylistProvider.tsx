import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';

import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  currentReplay: ReplayListRecord | undefined;
  replays: ReplayListRecord[] | undefined;
}

const Context = createContext<{
  currentReplayIndex: number;
  replays: ReplayListRecord[] | undefined;
}>({currentReplayIndex: -1, replays: undefined});

export function ReplayPlaylistProvider({children, currentReplay, replays}: Props) {
  const currentReplayIndex = useMemo(
    () => replays?.findIndex(r => r.id === currentReplay?.id) ?? -1,
    [replays, currentReplay]
  );
  return <Context value={{replays, currentReplayIndex}}>{children}</Context>;
}

export function useReplayPlaylist() {
  return useContext(Context);
}
