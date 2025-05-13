import {useEffect} from 'react';

import type {CodecovContextData} from 'sentry/components/codecov/context/codecovContext';
import {CodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type CodecovProviderProps = {
  children?: NonNullable<React.ReactNode>;
};

export default function CodecovQueryParamsProvider({children}: CodecovProviderProps) {
  const organization = useOrganization();
  const orgSlug = organization.slug;

  const location = useLocation();
  const [localStorageState, setLocalStorageState] = useLocalStorageState(
    `codecov-selection:${orgSlug}`,
    {} as Partial<CodecovContextData>
  );

  useEffect(() => {
    const queryRepository = location.query.repository;
    const queryIntegratedOrg = location.query.integratedOrg;
    const queryBranch = location.query.branch;
    const queryCodecovPeriod = location.query.codecovPeriod;
    const validEntries = {} as Partial<CodecovContextData>;

    if (typeof queryRepository === 'string' && queryRepository.trim() !== '') {
      validEntries.repository = queryRepository;
    }
    if (typeof queryIntegratedOrg === 'string' && queryIntegratedOrg.trim() !== '') {
      validEntries.integratedOrg = queryIntegratedOrg;
    }
    if (typeof queryBranch === 'string' && queryBranch.trim() !== '') {
      validEntries.branch = queryBranch;
    }
    if (typeof queryCodecovPeriod === 'string' && queryCodecovPeriod.trim() !== '') {
      validEntries.codecovPeriod = queryCodecovPeriod;
    }

    setLocalStorageState(prev => ({
      ...prev,
      ...validEntries,
    }));
  }, [setLocalStorageState, location.query]);

  const params: CodecovContextData = {
    repository:
      ((typeof location.query.repository === 'string' &&
        decodeURIComponent(location.query.repository)) ||
        localStorageState.repository) ??
      null,
    integratedOrg:
      (typeof location.query.integratedOrg === 'string' &&
        decodeURIComponent(location.query.integratedOrg)) ||
      localStorageState.integratedOrg ||
      null,
    branch:
      (typeof location.query.branch === 'string' &&
        decodeURIComponent(location.query.branch)) ||
      localStorageState.branch ||
      null,
    codecovPeriod:
      (typeof location.query.codecovPeriod === 'string' &&
        decodeURIComponent(location.query.codecovPeriod)) ||
      localStorageState.codecovPeriod ||
      '24h',
  };

  return <CodecovContext.Provider value={params}>{children}</CodecovContext.Provider>;
}
