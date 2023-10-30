import {useCallback} from 'react';
import {browserHistory} from 'react-router';

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
      const location = browserHistory.getCurrentLocation();
      return location.query[key] ?? defaultValue;
    },
    [defaultValue]
  );

  const setParamValue = useCallback((key: string, value: string) => {
    const location = browserHistory.getCurrentLocation();
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        [key]: value,
      },
    });
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
