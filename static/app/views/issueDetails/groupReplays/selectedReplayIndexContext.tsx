import {createContext, useContext} from 'react';

import {decodeInteger} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

const SelectedReplayIndexContext = createContext<number>(0);

export function SelectedReplayIndexProvider({children}: {children: React.ReactNode}) {
  const {selected_replay_index: selectedReplayIndex} = useLocationQuery({
    fields: {
      selected_replay_index: decodeInteger,
    },
  });

  return (
    <SelectedReplayIndexContext.Provider value={selectedReplayIndex ?? 0}>
      {children}
    </SelectedReplayIndexContext.Provider>
  );
}

export function useSelectedReplayIndex() {
  return useContext(SelectedReplayIndexContext);
}
