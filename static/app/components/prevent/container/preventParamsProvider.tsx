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
  integratedOrgId: string | null;
  repository: string | null;
};

type LocalStorageState = Record<string, Org> & {
  lastVisitedOrgName?: string;
  preventPeriod?: string;
};

const VALUES_TO_RESET_URL_PARAMS = ['repository', 'branch', 'testSuites'];

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

    const localStorageLastVisitedOrgName = localStorageState?.lastVisitedOrgName;
    const integratedOrgName =
      currentParams?.integratedOrgName || localStorageLastVisitedOrgName || undefined;

    const integratedOrgId =
      (integratedOrgName
        ? localStorageState?.[integratedOrgName]?.integratedOrgId
        : null) || undefined;
    const repository =
      (integratedOrgName ? localStorageState?.[integratedOrgName]?.repository : null) ||
      currentParams?.repository ||
      undefined;
    const branch =
      (integratedOrgName ? localStorageState?.[integratedOrgName]?.branch : null) ||
      currentParams?.branch ||
      null;
    const preventPeriod =
      currentParams?.preventPeriod || localStorageState.preventPeriod || '24h';

    return {
      integratedOrgId,
      integratedOrgName,
      repository,
      branch,
      preventPeriod,
    };
  }

  const changeContextValue = useCallback(
    (input: Partial<PreventContextDataParams>) => {
      const currentParams = Object.fromEntries(searchParams.entries());
      const integratedOrgName = input.integratedOrgName;

      setLocalStorageState((prev: LocalStorageState) => {
        const prevState = {...prev};

        if (integratedOrgName) {
          VALUES_TO_RESET_URL_PARAMS.forEach(key => {
            delete currentParams[key];
          });

          prevState[integratedOrgName] = {
            integratedOrgId:
              input.integratedOrgId ??
              prevState[integratedOrgName]?.integratedOrgId ??
              null,
            repository:
              input.repository ?? prevState[integratedOrgName]?.repository ?? null,
            branch: input.branch ?? null,
          };
          prevState.lastVisitedOrgName = integratedOrgName;
          prevState.preventPeriod = input.preventPeriod ? input.preventPeriod : '24h';
        }

        return prevState;
      });

      const updatedParams = {
        ...currentParams,
        ...input,
      };

      if (!input.branch) {
        delete updatedParams.branch;
      }

      if (updatedParams.integratedOrgId) {
        delete updatedParams.integratedOrgId;
      }

      setSearchParams(updatedParams as Record<string, string>);
    },
    [searchParams, setLocalStorageState, setSearchParams]
  );

  const {integratedOrgId, integratedOrgName, repository, branch, preventPeriod} =
    _defineParams();

  // Save repository and branch to localStorage when they come from URL params
  useEffect(() => {
    const currentParams = Object.fromEntries(searchParams.entries());
    const shouldSave = currentParams?.repository || currentParams?.branch;

    if (shouldSave && integratedOrgName) {
      setLocalStorageState((prev: LocalStorageState) => {
        const newState = {...prev};

        if (currentParams?.repository) {
          newState[integratedOrgName] = {
            ...newState[integratedOrgName],
            repository: currentParams.repository,
            branch: currentParams?.branch || newState[integratedOrgName]?.branch || null,
            integratedOrgId: newState[integratedOrgName]?.integratedOrgId || null,
          };
          newState.lastVisitedOrgName = integratedOrgName;
        }

        return newState;
      });
    }
  }, [searchParams, integratedOrgName, setLocalStorageState]);

  const params: PreventContextData = {
    ...(repository ? {repository} : {}),
    ...(integratedOrgId ? {integratedOrgId} : {}),
    ...(integratedOrgName ? {integratedOrgName} : {}),
    branch,
    preventPeriod,
    changeContextValue,
  };

  return <PreventContext.Provider value={params}>{children}</PreventContext.Provider>;
}
