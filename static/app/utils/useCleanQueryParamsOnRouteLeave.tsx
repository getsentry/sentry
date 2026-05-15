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
      // @ts-expect-error TS(2862): Type 'Q' is generic and can only be indexed for reading.
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

  const fieldsToCleanRef = useRef(fieldsToClean);
  fieldsToCleanRef.current = fieldsToClean;
  const shouldCleanRef = useRef(shouldClean);
  shouldCleanRef.current = shouldClean;

  useEffect(() => {
    const oldPathname = previousPathnameRef.current;
    previousPathnameRef.current = location.pathname;

    if (!shouldCleanRef.current || shouldCleanRef.current(location as Location<Q>)) {
      const cleanLocation = getCleanLocationIfNeeded({
        fieldsToClean: fieldsToCleanRef.current,
        newLocation: location as Location<Q & Record<PropertyKey, unknown>>,
        oldPathname,
      });

      if (cleanLocation) {
        navigate(cleanLocation, {replace: true, preventScrollReset: true});
      }
    }
  }, [location, navigate]);

  // When the component unmounts due to route change, the effect above won't
  // fire because React unmounts the component before re-rendering with the
  // new location. Use navigate to stay in sync with React Router.
  useEffect(() => {
    return () => {
      const oldPathname = previousPathnameRef.current;
      const newUrl = new URL(window.location.href);

      if (newUrl.pathname === oldPathname) {
        return;
      }

      const query = Object.fromEntries(newUrl.searchParams.entries());
      const newLocation = {
        pathname: newUrl.pathname,
        search: newUrl.search,
        hash: newUrl.hash,
        state: null,
        query,
        key: '',
      } as Location<Q>;

      if (shouldCleanRef.current && !shouldCleanRef.current(newLocation)) {
        return;
      }

      const cleanLocation = getCleanLocationIfNeeded({
        fieldsToClean: fieldsToCleanRef.current,
        newLocation: newLocation as Location<Q & Record<PropertyKey, unknown>>,
        oldPathname,
      });

      if (cleanLocation) {
        navigate(cleanLocation, {
          replace: true,
          preventScrollReset: true,
        });
      }
    };
  }, []);
}
