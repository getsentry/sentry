import {useCallback, useEffect} from 'react';

import type {CodecovContextData} from 'sentry/components/codecov/context/codecovContext';
import {CodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  const navigate = useNavigate();

  const updateSelectorData: CodecovContextData['updateSelectorData'] = useCallback(
    data => {
      const currentParams = new URLSearchParams(location.search);
      currentParams.set(Object.keys(data)[0] as string, Object.values(data)[0] as string);
      navigate(`${location.pathname}?${currentParams.toString()}`, {replace: true});
    },
    [location.search, location.pathname, navigate]
  );

  useEffect(() => {
    const repository =
      typeof location.query.repository === 'string' ? location.query.repository : null;
    const integratedOrg =
      typeof location.query.integratedOrg === 'string'
        ? location.query.integratedOrg
        : null;
    const branch =
      typeof location.query.branch === 'string' ? location.query.branch : null;
    const codecovPeriod =
      typeof location.query.codcovPeriod === 'string'
        ? location.query.codcovPeriod
        : null;

    setLocalStorageState({repository, integratedOrg, branch, codecovPeriod});
  }, [setLocalStorageState, location.query]);

  const params: CodecovContextData = {
    repository:
      decodeURIComponent(location.query.repository as string).trim() ||
      localStorageState.repository ||
      null,
    integratedOrg:
      decodeURIComponent(location.query.integratedOrg as string).trim() ||
      localStorageState.integratedOrg ||
      null,
    branch:
      decodeURIComponent(location.query.branch as string).trim() ||
      localStorageState.branch ||
      null,
    codecovPeriod:
      decodeURIComponent(location.query.codecovPeriod as string).trim() ||
      localStorageState.codecovPeriod ||
      null,
    updateSelectorData,
  };

  return <CodecovContext.Provider value={params}>{children}</CodecovContext.Provider>;
}
