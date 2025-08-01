import {useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';

import {ALL_BRANCHES} from 'sentry/components/codecov/branchSelector/branchSelector';
import type {
  CodecovContextData,
  CodecovContextDataParams,
} from 'sentry/components/codecov/context/codecovContext';
import {CodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

type CodecovQueryParamsProviderProps = {
  children?: NonNullable<React.ReactNode>;
};

type Org = {
  branch: string | null;
  repository: string;
};

type LocalStorageState = Record<string, Org> & {
  codecovPeriod?: string;
  lastVisitedOrgId?: string;
};

const VALUES_TO_RESET = ['repository', 'branch', 'testSuites'];

export default function CodecovQueryParamsProvider({
  children,
}: CodecovQueryParamsProviderProps) {
  const organization = useOrganization();
  const initialLocalStorageState: LocalStorageState = {};
  const [localStorageState, setLocalStorageState] = useLocalStorageState(
    `codecov-selection:${organization.slug}`,
    initialLocalStorageState
  );

  const [searchParams, setSearchParams] = useSearchParams();

  function _defineParams(): CodecovContextDataParams {
    const currentParams = Object.fromEntries(searchParams.entries());

    const localStorageLastVisitedOrgId = localStorageState?.lastVisitedOrgId;
    const integratedOrgId =
      currentParams?.integratedOrgId || localStorageLastVisitedOrgId || undefined;
    const repository =
      (integratedOrgId ? localStorageState?.[integratedOrgId]?.repository : null) ||
      currentParams?.repository ||
      undefined;
    const branch =
      (integratedOrgId ? localStorageState?.[integratedOrgId]?.branch : null) ||
      currentParams?.branch ||
      'All Branches';
    const codecovPeriod =
      currentParams?.codecovPeriod || localStorageState.codecovPeriod || '24h';

    return {
      integratedOrgId,
      repository,
      branch,
      codecovPeriod,
    };
  }

  const changeContextValue = useCallback(
    (input: Partial<CodecovContextDataParams>) => {
      const currentParams = Object.fromEntries(searchParams.entries());
      const integratedOrgId = input.integratedOrgId;

      if (integratedOrgId && !localStorageState[integratedOrgId]) {
        VALUES_TO_RESET.forEach(key => {
          delete currentParams[key];
        });
      }

      setLocalStorageState((prev: LocalStorageState) => {
        const newState = {...prev};

        if (input.repository) {
          const orgId = input.integratedOrgId;

          if (orgId) {
            const branch = input.branch ? input.branch : ALL_BRANCHES;
            newState[orgId] = {repository: input.repository, branch};
            newState.lastVisitedOrgId = orgId;
          }
        }

        newState.codecovPeriod = input.codecovPeriod ? input.codecovPeriod : '24h';

        return newState;
      });

      const updatedParams = {
        ...currentParams,
        ...input,
      };

      setSearchParams(updatedParams);
    },
    [localStorageState, setLocalStorageState, setSearchParams, searchParams]
  );

  const {integratedOrgId, repository, branch, codecovPeriod} = _defineParams();

  const params: CodecovContextData = {
    ...(repository ? {repository} : {}),
    ...(integratedOrgId ? {integratedOrgId} : {}),
    ...(branch ? {branch} : {}),
    codecovPeriod,
    changeContextValue,
  };

  return <CodecovContext.Provider value={params}>{children}</CodecovContext.Provider>;
}
