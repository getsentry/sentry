import {useCallback, useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';

import type {
  CodecovContextData,
  CodecovContextDataParams,
} from 'sentry/components/codecov/context/codecovContext';
import {CodecovContext} from 'sentry/components/codecov/context/codecovContext';
import type {CodecovPeriodOptions} from 'sentry/components/codecov/dateSelector/dateSelector';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

type CodecovQueryParamsProviderProps = {
  children?: NonNullable<React.ReactNode>;
};

const VALUES_TO_RESET_MAP = {
  integratedOrg: ['repository', 'branch'],
  repository: ['branch'],
  branch: [],
  codecovPeriod: [],
};

export default function CodecovQueryParamsProvider({
  children,
}: CodecovQueryParamsProviderProps) {
  const organization = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localStorageState, setLocalStorageState] = useLocalStorageState(
    `codecov-selection:${organization.slug}`,
    {}
  );

  function _defineParam(key: string, defaultValue?: string | CodecovPeriodOptions) {
    const queryValue = searchParams.get(key);

    if (queryValue) {
      return decodeURIComponent(queryValue);
    }

    if (key in localStorageState) {
      return (localStorageState as Record<string, string>)[key];
    }

    if (defaultValue) {
      return defaultValue;
    }

    return undefined;
  }

  const changeContextValue = useCallback(
    (value: Partial<CodecovContextDataParams>) => {
      const currentParams = Object.fromEntries(searchParams.entries());
      const valueKey = Object.keys(value)[0] as keyof typeof value;
      const valuesToReset = VALUES_TO_RESET_MAP[valueKey];

      valuesToReset.forEach(key => {
        delete currentParams[key];
      });

      setLocalStorageState((prev: Partial<CodecovContextDataParams>) => {
        const newState = {...prev};
        valuesToReset.forEach(key => {
          delete newState[key as keyof CodecovContextDataParams];
        });
        return newState;
      });

      const updatedParams = {
        ...currentParams,
        ...value,
      };

      setSearchParams(updatedParams);
    },
    [searchParams, setLocalStorageState, setSearchParams]
  );

  useEffect(() => {
    const entries = {
      repository: searchParams.get('repository'),
      integratedOrg: searchParams.get('integratedOrg'),
      branch: searchParams.get('branch'),
      codecovPeriod: searchParams.get('codecovPeriod'),
    };

    for (const [key, value] of Object.entries(entries)) {
      if (!value) {
        delete entries[key as keyof typeof entries];
      }
    }

    setLocalStorageState(prev => ({
      ...prev,
      ...entries,
    }));
  }, [setLocalStorageState, searchParams]);

  const repository = _defineParam('repository');
  const integratedOrg = _defineParam('integratedOrg');
  const branch = _defineParam('branch');
  const codecovPeriod = _defineParam('codecovPeriod', '24h') as CodecovPeriodOptions;

  const params: CodecovContextData = {
    ...(repository ? {repository} : {}),
    ...(integratedOrg ? {integratedOrg} : {}),
    ...(branch ? {branch} : {}),
    codecovPeriod,
    changeContextValue,
  };

  return <CodecovContext.Provider value={params}>{children}</CodecovContext.Provider>;
}
