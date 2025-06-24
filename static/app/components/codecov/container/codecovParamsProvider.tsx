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

  const changeContextValue = useCallback(
    (value: Partial<CodecovContextDataParams>) => {
      const currentParams = Object.fromEntries(searchParams.entries());
      const valueKey = Object.keys(value)[0] as keyof typeof value;
      const valuesToReset = VALUES_TO_RESET_MAP[valueKey];

      for (const key of valuesToReset) {
        delete currentParams[key];
      }

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

  // Repository, org and branch default to null as its value to the option not being selected.
  // These only represent the unselected values and shouldn't be used when fetching backend data.
  const queryRepository = searchParams.get('repository');
  const queryIntegratedOrg = searchParams.get('integratedOrg');
  const queryBranch = searchParams.get('branch');
  const queryCodecovPeriod = searchParams.get('codecovPeriod');

  const params: CodecovContextData = {
    ...(typeof queryRepository === 'string'
      ? {repository: decodeURIComponent(queryRepository)}
      : 'repository' in localStorageState
        ? {repository: localStorageState.repository as string}
        : {}),

    ...(typeof queryIntegratedOrg === 'string'
      ? {integratedOrg: decodeURIComponent(queryIntegratedOrg)}
      : 'integratedOrg' in localStorageState
        ? {integratedOrg: localStorageState.integratedOrg as string}
        : {}),

    ...(typeof queryBranch === 'string'
      ? {branch: decodeURIComponent(queryBranch)}
      : 'branch' in localStorageState
        ? {branch: localStorageState.branch as string}
        : {}),

    ...(typeof queryCodecovPeriod === 'string'
      ? {codecovPeriod: decodeURIComponent(queryCodecovPeriod) as CodecovPeriodOptions}
      : 'codecovPeriod' in localStorageState
        ? {codecovPeriod: localStorageState.codecovPeriod as CodecovPeriodOptions}
        : {}),
    changeContextValue,
  };

  return <CodecovContext.Provider value={params}>{children}</CodecovContext.Provider>;
}
