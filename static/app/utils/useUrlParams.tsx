import {useCallback} from 'react';
import * as qs from 'query-string';

import {browserHistory} from 'sentry/utils/browserHistory';

// TODO(epurkhiser): Once we're on react-router 6 we should replace this with
// their useSearchParams hook

function useUrlParams(
  defaultKey: string,
  defaultValue: string
): {
  getParamValue: () => string;
  setParamValue: (value: string) => void;
};
function useUrlParams(defaultKey: string): {
  getParamValue: () => string | undefined;
  setParamValue: (value: string) => void;
};
function useUrlParams(): {
  getParamValue: (key: string) => string | undefined;
  setParamValue: (key: string, value: string) => void;
};
function useUrlParams(defaultKey?: string, defaultValue?: string) {
  const getParamValue = useCallback(
    (key: string) => {
      const currentQuery = qs.parse(window.location.search);

      // location.query.key can return string[] but we expect a singular value
      // from this function, so we return the first string (this is picked
      // arbitrarily) if it's string[]
      return Array.isArray(currentQuery[key])
        ? currentQuery[key]?.at(0) ?? defaultValue
        : currentQuery[key] ?? defaultValue;
    },
    [defaultValue]
  );

  const setParamValue = useCallback((key: string, value: string) => {
    const currentQuery = qs.parse(window.location.search);
    const query = {...currentQuery, [key]: value};
    browserHistory.push({pathname: location.pathname, query});
  }, []);

  const getWithDefault = useCallback(
    () => getParamValue(defaultKey || ''),
    [getParamValue, defaultKey]
  );
  const setWithDefault = useCallback(
    (value: string) => setParamValue(defaultKey || '', value),
    [setParamValue, defaultKey]
  );

  if (defaultKey !== undefined) {
    return {
      getParamValue: getWithDefault,
      setParamValue: setWithDefault,
    };
  }

  return {
    getParamValue,
    setParamValue,
  };
}

export default useUrlParams;
