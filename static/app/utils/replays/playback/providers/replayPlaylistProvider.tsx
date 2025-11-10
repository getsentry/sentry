import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  replays: ReplayListRecord[] | undefined;
}

const Context = createContext<ReplayListRecord[] | undefined>(undefined);

export function ReplayPlaylistProvider({children, replays}: Props) {
  return <Context value={replays}>{children}</Context>;
}

export function useReplayPlaylist() {
  return useContext(Context);
}
