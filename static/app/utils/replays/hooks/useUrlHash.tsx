import {useCallback} from 'react';

type State = Record<string, string>;

function parse(input: string) {
  try {
    const clean = input.replace(/^\#/, '');
    const decoded = Object.fromEntries(
      clean
        .split(';')
        .map(kv => kv.split('='))
        .map(([key, value]) => [decodeURIComponent(key), decodeURIComponent(value)])
    );
    return decoded as State;
  } catch (e) {
    return {};
  }
}

function serialize(state: State) {
  const encoded = Object.entries(state)
    .filter(([key, value]) => key !== '' && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join(';');
  return encoded;
}

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
  const getHashValue = useCallback(
    (key: string) => parse(window.location.hash)[key] || defaultValue,
    [defaultValue]
  );

  const setHashValue = useCallback((key: string, value: string) => {
    window.location.hash = serialize({
      ...parse(window.location.hash),
      [key]: value,
    });
  }, []);

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
