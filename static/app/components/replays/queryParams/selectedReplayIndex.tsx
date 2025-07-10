import {createContext, useCallback, useContext} from 'react';

import {decodeInteger} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

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
  const location = useLocation();
  const navigate = useNavigate();

  const index = useContext(SelectedReplayIndexContext);

  return {
    index,
    select: useCallback(
      (newIndex: number) => {
        navigate(
          {
            pathname: location.pathname,
            query: {...location.query, selected_replay_index: newIndex},
          },
          {replace: true, preventScrollReset: true}
        );
      },
      [location, navigate]
    ),
  };
}
