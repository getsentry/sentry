import {useCallback} from 'react';
import {browserHistory} from 'react-router';

import {useRouteContext} from 'sentry/utils/useRouteContext';

function useUrlParams(
  defaultKey: string,
  defaultValue: string
): {
  getParamValue: () => string;
  setParamValue: (value: string) => void;
};
function useUrlParams(defaultKey: string): {
  getParamValue: () => string;
  setParamValue: (value: string) => void;
};
function useUrlParams(): {
  getParamValue: (key: string) => string;
  setParamValue: (key: string, value: string) => void;
};
function useUrlParams(defaultKey?: string, defaultValue?: string) {
  const {location} = useRouteContext();

  const getParamValue = useCallback(
    (key: string) => {
      return location.query[key] || defaultValue;
    },
    [location, defaultValue]
  );

  const setParamValue = useCallback(
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
