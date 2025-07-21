import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

import ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  children: ReactNode;
  replay: ReplayReader | null;
}

const Context = createContext<ReplayReader | null>(
  ReplayReader.factory({
    attachments: [],
    errors: [],
    fetching: false,
    replayRecord: undefined,
  })
);

export function ReplayReaderProvider({children, replay}: Props) {
  return <Context value={replay}>{children}</Context>;
}

export function useReplayReader() {
  return useContext(Context);
}
