import {useCallback, useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';

import type {
  CodecovContextData,
  CodecovContextDataParams,
} from 'sentry/components/codecov/context/codecovContext';
import {CodecovContext} from 'sentry/components/codecov/context/codecovContext';
import type {CodecovPeriodOptions} from 'sentry/components/codecov/datePicker/dateSelector';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

type CodecovQueryParamsProviderProps = {
  children?: NonNullable<React.ReactNode>;
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

  useEffect(() => {
    const validEntries = {
      repository: searchParams.get('repository'),
      integratedOrg: searchParams.get('integratedOrg'),
      branch: searchParams.get('branch'),
      codecovPeriod: searchParams.get('codecovPeriod'),
    };

    for (const [key, value] of Object.entries(validEntries)) {
      if (!value || typeof value !== 'string') {
        delete validEntries[key as keyof Omit<CodecovContextData, 'handleReset'>];
      }
    }

    setLocalStorageState(prev => ({
      ...prev,
      ...validEntries,
    }));
  }, [setLocalStorageState, searchParams]);

  // TODO: Adjust this function to revert to default values for keys to reset
  const handleReset = useCallback(
    (valuesToReset: CodecovContextDataParams[]) => {
      const newSearchParams = new URLSearchParams(searchParams);
      valuesToReset.forEach(key => newSearchParams.delete(key));
      setSearchParams(newSearchParams);

      setLocalStorageState((prev: CodecovContextData) => {
        const newState = {...prev};
        valuesToReset.forEach(key => {
          if (newState[key]) {
            delete newState[key];
          }
        });
        return newState;
      });
    },
    [searchParams, setSearchParams, setLocalStorageState]
  );

  // Repository, org and branch default to null as its value to the option not being selected.
  // These only represent the unselected values and shouldn't be used when fetching backend data.
  const queryRepository = searchParams.get('repository');
  const queryIntegratedOrg = searchParams.get('integratedOrg');
  const queryBranch = searchParams.get('branch');
  const queryCodecovPeriod = searchParams.get('codecovPeriod');

  const params: CodecovContextData = {
    repository:
      typeof queryRepository === 'string'
        ? decodeURIComponent(queryRepository)
        : 'repository' in localStorageState
          ? (localStorageState.repository as string)
          : null,
    integratedOrg:
      typeof queryIntegratedOrg === 'string'
        ? decodeURIComponent(queryIntegratedOrg)
        : 'integratedOrg' in localStorageState
          ? (localStorageState.integratedOrg as string)
          : null,
    branch:
      typeof queryBranch === 'string'
        ? decodeURIComponent(queryBranch)
        : 'branch' in localStorageState
          ? (localStorageState.branch as string)
          : null,
    codecovPeriod:
      typeof queryCodecovPeriod === 'string'
        ? (decodeURIComponent(queryCodecovPeriod) as CodecovPeriodOptions)
        : 'codecovPeriod' in localStorageState
          ? (localStorageState.codecovPeriod as CodecovPeriodOptions)
          : '24h',
    handleReset,
  };

  return <CodecovContext.Provider value={params}>{children}</CodecovContext.Provider>;
}
