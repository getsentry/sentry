import {useCallback} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export function useTitle(): [string | undefined, (newTitle: string) => void] {
  const navigate = useNavigate();
  const location = useLocation();

  const {title} = useLocationQuery({
    fields: {
      title: decodeScalar,
    },
  });

  const setTitle = useCallback(
    (newTitle: string) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          title: newTitle,
        },
      });
    },
    [location, navigate]
  );

  return [title, setTitle];
}
