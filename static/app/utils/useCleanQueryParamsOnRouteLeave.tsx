import {useEffect, useRef} from 'react';
import type {Location} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type Opts<Q> = {
  fieldsToClean: string[];
  shouldClean?: (newLocation: Location<Q>) => boolean;
};

export function getCleanLocationIfNeeded<Q extends Record<PropertyKey, unknown>>({
  fieldsToClean,
  newLocation,
  oldPathname,
}: {
  fieldsToClean: string[];
  newLocation: Location<Q>;
  oldPathname: string;
}): {pathname: string; query: Record<string, unknown>} | null {
  const hasSomeValues = fieldsToClean.some(
    field => newLocation.query[field] !== undefined
  );

  if (newLocation.pathname === oldPathname || !hasSomeValues) {
    return null;
  }

  const query = fieldsToClean.reduce(
    (newQuery, field) => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      newQuery[field] = undefined;
      return newQuery;
    },
    {...newLocation.query}
  );

  return {pathname: newLocation.pathname, query};
}

export function useCleanQueryParamsOnRouteLeave<Q>({
  fieldsToClean,
  shouldClean,
}: Opts<Q>) {
  const location = useLocation();
  const navigate = useNavigate();
  const previousPathnameRef = useRef(location.pathname);

  useEffect(() => {
    const oldPathname = previousPathnameRef.current;
    previousPathnameRef.current = location.pathname;

    if (!shouldClean || shouldClean(location as Location<Q>)) {
      const cleanLocation = getCleanLocationIfNeeded({
        fieldsToClean,
        newLocation: location as Location<Q & Record<PropertyKey, unknown>>,
        oldPathname,
      });

      if (cleanLocation) {
        navigate(cleanLocation, {replace: true});
      }
    }
  }, [location, fieldsToClean, shouldClean, navigate]);
}
