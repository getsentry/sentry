import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  replays: ReplayRecord[] | null;
}

const Context = createContext<ReplayRecord[] | null>(null);

export function ReplayPlaylistProvider({children, replays}: Props) {
  return <Context value={replays}>{children}</Context>;
}

export function useReplayPlaylist() {
  return useContext(Context);
}
