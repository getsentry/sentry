import {createContext, ReactNode, useContext} from 'react';

import useReplaysCount from 'sentry/components/replays/useReplaysCount';

const ReplayCountContext = createContext<ReturnType<typeof useReplaysCount>>({});

export function ReplayCountContextProvider({
  children,
  ...opts
}: Parameters<typeof useReplaysCount>[0] & {children: ReactNode}) {
  const counts = useReplaysCount(opts);
  return (
    <ReplayCountContext.Provider value={counts}>{children}</ReplayCountContext.Provider>
  );
}

export function useReplaysCountContext() {
  const context = useContext(ReplayCountContext);
  return context;
}
