import {useCallback, useEffect} from 'react';
import type {Location} from 'history';

import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';

type Opts<Q> = {
  fieldsToClean: string[];
  shouldClean?: (newLocation: Location<Q>) => boolean;
};

export function handleRouteLeave<Q extends object>({
  fieldsToClean,
  newLocation,
  oldPathname,
}: {
  fieldsToClean: string[];
  newLocation: Location<Q>;
  oldPathname: string;
}) {
  const hasSomeValues = fieldsToClean.some(
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    field => newLocation.query[field] !== undefined
  );

  if (newLocation.pathname === oldPathname || !hasSomeValues) {
    return;
  }

  // Removes fields from the URL on route leave so that the parameters will
  // not interfere with other pages
  const query = fieldsToClean.reduce(
    (newQuery, field) => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      newQuery[field] = undefined;
      return newQuery;
    },
    {...newLocation.query}
  );

  browserHistory.replace({
    pathname: newLocation.pathname,
    query,
  });
}

function useCleanQueryParamsOnRouteLeave<Q>({fieldsToClean, shouldClean}: Opts<Q>) {
  const location = useLocation();

  const onRouteLeave = useCallback(
    (newLocation: any) => {
      if (!shouldClean || shouldClean(newLocation)) {
        handleRouteLeave({
          fieldsToClean,
          newLocation,
          oldPathname: location.pathname,
        });
      }
    },
    [shouldClean, fieldsToClean, location.pathname]
  );

  useEffect(() => {
    return browserHistory.listen(onRouteLeave);
  }, [onRouteLeave]);
}

export default useCleanQueryParamsOnRouteLeave;
