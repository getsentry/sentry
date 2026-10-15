import {createContext, useCallback, useContext} from 'react';
import {parseAsInteger, useQueryState} from 'nuqs';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

const SelectedReplayIndexContext = createContext(0);

export function SelectedReplayIndexProvider({children}: {children: React.ReactNode}) {
  const [selectedReplayIndex] = useQueryState(
    'selected_replay_index',
    parseAsInteger.withDefault(0)
  );

  return (
    <SelectedReplayIndexContext.Provider value={selectedReplayIndex}>
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
