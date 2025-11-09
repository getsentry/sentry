import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  playlist: {
    currentIndex: number;
    replays: ReplayListRecord[];
  };
}

const Context = createContext<ReplayListRecord[] | null>([]);

export function ReplayReaderProvider({children, replays}: Props) {
  return <Context value={replays}>{children}</Context>;
}

export function useReplayReader() {
  return useContext(Context);
}
