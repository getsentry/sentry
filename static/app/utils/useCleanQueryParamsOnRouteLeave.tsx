import {useCallback, useEffect} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {useLocation} from 'sentry/utils/useLocation';

type Opts = {
  fields: string[];
};

function useCleanQueryParamsOnRouteLeave({fields}: Opts) {
  const location = useLocation();

  const handleRouteLeave = useCallback(
    (newLocation: Location<{cursor?: string; level?: number}>) => {
      const hasSomeValues = fields.some(field => newLocation.query[field] !== undefined);

      if (
        newLocation.pathname === location.pathname ||
        (newLocation.pathname !== location.pathname && !hasSomeValues)
      ) {
        return true;
      }

      // Removes fields from the URL on route leave so that the parameters will
      // not interfere with other pages
      const query = fields.reduce(
        (newQuery, field) => {
          newQuery[field] = undefined;
          return newQuery;
        },
        {...newLocation.query}
      );

      browserHistory.replace({
        pathname: newLocation.pathname,
        query,
      });

      return false;
    },
    [location.pathname, fields]
  );

  useEffect(() => {
    return browserHistory.listen(handleRouteLeave);
  }, [handleRouteLeave]);
}

export default useCleanQueryParamsOnRouteLeave;
