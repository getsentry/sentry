import {createContext, useContext, useMemo} from 'react';

import {useReplayProjectSlug} from 'sentry/utils/replays/hooks/useReplayProjectSlug';
import ReplayReader from 'sentry/utils/replays/replayReader';

type Basics = {
  projectSlug: ReturnType<typeof useReplayProjectSlug>;
  replay: ReplayReader;
};
const context = createContext<Basics>({
  projectSlug: '',
  replay: ReplayReader.factory({
    attachments: [],
    errors: [],
    fetching: false,
    replayRecord: undefined,
  })!,
});

export function ReplayReaderProvider({
  children,
  replay,
}: {
  children: React.ReactNode;
  replay: ReplayReader;
}) {
  const projectSlug = useReplayProjectSlug({replayRecord: replay.getReplay()});

  const basics = useMemo(
    (): Basics => ({
      projectSlug,
      replay,
    }),
    [projectSlug, replay]
  );
  return <context.Provider value={basics}>{children}</context.Provider>;
}

export function useReplayBasics() {
  return useContext(context);
}
