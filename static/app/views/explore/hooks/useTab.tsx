import {useCallback, useMemo} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export enum Tab {
  SPAN = 'span',
  TRACE = 'trace',
}

export function useTab(): [Tab, (tab: Tab) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  const tab = useMemo(() => {
    const rawTab = decodeScalar(location.query.table);
    if (rawTab === 'trace') {
      return Tab.TRACE;
    }
    return Tab.SPAN;
  }, [location.query.table]);

  const setTab = useCallback(
    (newTab: Tab) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          table: newTab,
          cursor: undefined,
        },
      });
    },
    [location, navigate]
  );

  return [tab, setTab];
}
