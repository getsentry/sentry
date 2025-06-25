import {useCallback} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export default function useSelectReplayIndex() {
  const location = useLocation();
  const navigate = useNavigate();
  return {
    select: useCallback(
      (index: number) => {
        navigate(
          {
            pathname: location.pathname,
            query: {...location.query, selected_replay_index: index},
          },
          {replace: true, preventScrollReset: true}
        );
      },
      [location, navigate]
    ),
  };
}
