import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

import ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  children: ReactNode;
  replay: ReplayReader;
}

const context = createContext<ReplayReader>(
  ReplayReader.factory({
    attachments: [],
    errors: [],
    fetching: false,
    replayRecord: undefined,
  })!
);

export function ReplayReaderProvider({children, replay}: Props) {
  return <context.Provider value={replay}>{children}</context.Provider>;
}

export function useReplayReader() {
  return useContext(context);
}
