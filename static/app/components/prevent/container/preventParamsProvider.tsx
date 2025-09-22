import {useCallback, useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';

import type {
  PreventContextData,
  PreventContextDataParams,
} from 'sentry/components/prevent/context/preventContext';
import {PreventContext} from 'sentry/components/prevent/context/preventContext';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

type PreventQueryParamsProviderProps = {
  children?: NonNullable<React.ReactNode>;
};

type Org = {
  branch: string | null;
  repository: string;
};

type LocalStorageState = Record<string, Org> & {
  lastVisitedOrgId?: string;
  preventPeriod?: string;
};

const VALUES_TO_RESET = ['repository', 'branch', 'testSuites'];

export default function PreventQueryParamsProvider({
  children,
}: PreventQueryParamsProviderProps) {
  const organization = useOrganization();
  const initialLocalStorageState: LocalStorageState = {};
  const [localStorageState, setLocalStorageState] = useLocalStorageState(
    `prevent-selection:${organization.slug}`,
    initialLocalStorageState
  );

  const [searchParams, setSearchParams] = useSearchParams();

  function _defineParams(): PreventContextDataParams {
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
      null;
    const preventPeriod =
      currentParams?.preventPeriod || localStorageState.preventPeriod || '24h';

    return {
      integratedOrgId,
      repository,
      branch,
      preventPeriod,
    };
  }

  const changeContextValue = useCallback(
    (input: Partial<PreventContextDataParams>) => {
      const currentParams = Object.fromEntries(searchParams.entries());
      const integratedOrgId = input.integratedOrgId;

      setLocalStorageState((prev: LocalStorageState) => {
        if (integratedOrgId && !prev[integratedOrgId]) {
          VALUES_TO_RESET.forEach(key => {
            delete currentParams[key];
          });
        }

        const newState = {...prev};

        if (input.repository) {
          const orgId = input.integratedOrgId;

          if (orgId) {
            const branch = input.branch ?? null;

            newState[orgId] = {repository: input.repository, branch};
            newState.lastVisitedOrgId = orgId;
          }
        }

        newState.preventPeriod = input.preventPeriod ? input.preventPeriod : '24h';

        return newState;
      });

      const updatedParams = {
        ...currentParams,
        ...input,
      };

      if (!input.branch) {
        delete updatedParams.branch;
      }

      setSearchParams(updatedParams as Record<string, string>);
    },
    [searchParams, setLocalStorageState, setSearchParams]
  );

  const {integratedOrgId, repository, branch, preventPeriod} = _defineParams();

  // Save repository and branch to localStorage when they come from URL params
  useEffect(() => {
    const currentParams = Object.fromEntries(searchParams.entries());
    const shouldSave = currentParams?.repository || currentParams?.branch;

    if (shouldSave && integratedOrgId) {
      setLocalStorageState((prev: LocalStorageState) => {
        const newState = {...prev};

        if (currentParams?.repository) {
          newState[integratedOrgId] = {
            ...newState[integratedOrgId],
            repository: currentParams.repository,
            branch: currentParams?.branch || newState[integratedOrgId]?.branch || null,
          };
          newState.lastVisitedOrgId = integratedOrgId;
        }

        return newState;
      });
    }
  }, [searchParams, integratedOrgId, setLocalStorageState]);

  const params: PreventContextData = {
    ...(repository ? {repository} : {}),
    ...(integratedOrgId ? {integratedOrgId} : {}),
    branch,
    preventPeriod,
    changeContextValue,
  };

  return <PreventContext.Provider value={params}>{children}</PreventContext.Provider>;
}
