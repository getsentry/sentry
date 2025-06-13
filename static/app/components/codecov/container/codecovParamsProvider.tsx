import {useEffect} from 'react';

import type {CodecovContextData} from 'sentry/components/codecov/context/codecovContext';
import {CodecovContext} from 'sentry/components/codecov/context/codecovContext';
import type {CodecovPeriodOptions} from 'sentry/components/codecov/datePicker/dateSelector';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type CodecovQueryParamsProviderProps = {
  children?: NonNullable<React.ReactNode>;
};

export default function CodecovQueryParamsProvider({
  children,
}: CodecovQueryParamsProviderProps) {
  const organization = useOrganization();

  const location = useLocation();
  const [localStorageState, setLocalStorageState] = useLocalStorageState(
    `codecov-selection:${organization.slug}`,
    {}
  );

  useEffect(() => {
    const validEntries = {
      repository: location.query.repository,
      integratedOrg: location.query.integratedOrg,
      branch: location.query.branch,
      codecovPeriod: location.query.codecovPeriod,
    };

    for (const [key, value] of Object.entries(validEntries)) {
      if (!value || typeof value !== 'string') {
        delete validEntries[key as keyof CodecovContextData];
      }
    }

    setLocalStorageState(prev => ({
      ...prev,
      ...validEntries,
    }));
  }, [setLocalStorageState, location.query]);

  // Repository, org and branch default to null as its value to the option not being selected.
  // These only represent the unselected values and shouldn't be used when fetching backend data.
  const params: CodecovContextData = {
    repository:
      typeof location.query.repository === 'string'
        ? decodeURIComponent(location.query.repository)
        : 'repository' in localStorageState
          ? (localStorageState.repository as string)
          : null,
    integratedOrg:
      typeof location.query.integratedOrg === 'string'
        ? decodeURIComponent(location.query.integratedOrg)
        : 'integratedOrg' in localStorageState
          ? (localStorageState.integratedOrg as string)
          : null,
    branch:
      typeof location.query.branch === 'string'
        ? decodeURIComponent(location.query.branch)
        : 'branch' in localStorageState
          ? (localStorageState.branch as string)
          : null,
    codecovPeriod:
      typeof location.query.codecovPeriod === 'string'
        ? (decodeURIComponent(location.query.codecovPeriod) as CodecovPeriodOptions)
        : 'codecovPeriod' in localStorageState
          ? (localStorageState.codecovPeriod as CodecovPeriodOptions)
          : '24h',
  };

  return <CodecovContext.Provider value={params}>{children}</CodecovContext.Provider>;
}
