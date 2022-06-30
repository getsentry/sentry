import {useCallback} from 'react';
import {browserHistory} from 'react-router';

import {useRouteContext} from 'sentry/utils/useRouteContext';

function useUrlHash(
  defaultKey: string,
  defaultValue: string
): {
  getHashValue: () => string;
  setHashValue: (value: string) => void;
};
function useUrlHash(defaultKey: string): {
  getHashValue: () => string;
  setHashValue: (value: string) => void;
};
function useUrlHash(): {
  getHashValue: (key: string) => string;
  setHashValue: (key: string, value: string) => void;
};
function useUrlHash(defaultKey?: string, defaultValue?: string) {
  const {location} = useRouteContext();

  const getHashValue = useCallback(
    (key: string) => {
      return location.query[key] || defaultValue;
    },
    [location, defaultValue]
  );

  const setHashValue = useCallback(
    (key: string, value: string) => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          [key]: value,
        },
      });
    },
    [location]
  );

  const getWithDefault = useCallback(
    () => getHashValue(defaultKey || ''),
    [getHashValue, defaultKey]
  );
  const setWithDefault = useCallback(
    (value: string) => setHashValue(defaultKey || '', value),
    [setHashValue, defaultKey]
  );

  if (defaultKey !== undefined) {
    return {
      getHashValue: getWithDefault,
      setHashValue: setWithDefault,
    };
  }

  return {
    getHashValue,
    setHashValue,
  };
}

export default useUrlHash;
