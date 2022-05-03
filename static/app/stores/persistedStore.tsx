import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {OnboardingState} from 'sentry/views/onboarding/targetedOnboarding/types';

import OrganizationStore from './organizationStore';
import {useLegacyStore} from './useLegacyStore';

type PersistedStore = Readonly<{
  onboarding: Partial<OnboardingState> | null;
}>;

export const DefaultPersistedStore: PersistedStore = {
  onboarding: null,
};

export const DefaultLoadedPersistedStore: PersistedStore = {
  onboarding: {},
};

type PersistedStoreContextValue = [
  PersistedStore,
  React.Dispatch<React.SetStateAction<PersistedStore>>
];

export const PersistedStoreContext = createContext<PersistedStoreContextValue | null>(
  null
);

function usePersistedStore(): PersistedStoreContextValue {
  const context = useContext(PersistedStoreContext);

  if (!context) {
    throw new Error('usePersistedStore was called outside of PersistedStoreProvider');
  }

  return context;
}

// Client-only state with TTL persisted on the server side in a redis store.
export function PersistedStoreProvider(props: {children: React.ReactNode}) {
  const [state, setState] = useState<PersistedStore>(DefaultPersistedStore);

  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);

  useEffect(() => {
    if (!organization) {
      return undefined;
    }

    let shouldCancelRequest = false;
    api
      .requestPromise(`/organizations/${organization.slug}/client-state/`)
      .then((response: PersistedStore) => {
        if (shouldCancelRequest) {
          return;
        }
        setState({...DefaultLoadedPersistedStore, ...response});
      })
      .catch(() => {
        setState(DefaultPersistedStore);
      });

    return () => {
      shouldCancelRequest = true;
    };
  }, [organization]);

  return (
    <PersistedStoreContext.Provider value={[state, setState]}>
      {props.children}
    </PersistedStoreContext.Provider>
  );
}

type UsePersistedCategory<T> = [T | null, (nextState: T | null) => void];
export function usePersistedStoreCategory<C extends keyof PersistedStore>(
  category: C
): UsePersistedCategory<PersistedStore[C]> {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const [state, setState] = usePersistedStore();

  const setCategoryState = useCallback(
    (val: PersistedStore[C] | null) => {
      setState(oldState => ({...oldState, [category]: val}));

      // If a state is set with null, we can clear it from the server.
      const endpointLocation = `/organizations/${organization.slug}/client-state/${category}/`;
      if (val === null) {
        api.requestPromise(endpointLocation, {
          method: 'DELETE',
        });
        return;
      }

      // Else we want to sync our state with the server
      api.requestPromise(endpointLocation, {
        method: 'PUT',
        data: val,
      });
    },
    [category, organization]
  );

  const stableState: UsePersistedCategory<PersistedStore[C]> = useMemo(() => {
    return [state[category] ?? null, setCategoryState];
  }, [state[category], setCategoryState]);

  return stableState;
}
