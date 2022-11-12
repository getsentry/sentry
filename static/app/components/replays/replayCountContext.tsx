import {createContext, ReactNode, useContext} from 'react';

import useReplaysCounts from 'sentry/components/replays/useReplaysCount';

const ReplayCountContext = createContext<ReturnType<typeof useReplaysCounts>>({});

export function ReplayCountContextProvider({
  children,
  ...opts
}: Parameters<typeof useReplaysCounts>[0] & {children: ReactNode}) {
  const counts = useReplaysCounts(opts);
  return (
    <ReplayCountContext.Provider value={counts}>{children}</ReplayCountContext.Provider>
  );
}

export function useReplaysCountContext() {
  const context = useContext(ReplayCountContext);
  return context;
}
