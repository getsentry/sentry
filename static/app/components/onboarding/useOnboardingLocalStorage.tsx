import {useCallback} from 'react';

import {PlatformKey} from 'sentry/data/platformCategories';
import ConfigStore from 'sentry/stores/configStore';
import {PlatformIntegration} from 'sentry/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

type LocalState = {
  selectedPlatform?: PlatformIntegration & {
    key: PlatformKey;
  };
};

export function useOnboardingLocalStorage(): [
  LocalState,
  (newState: Partial<LocalState>) => void
] {
  const user = ConfigStore.get('user');

  const [localStorageState, setLocalStorageState] = useLocalStorageState<LocalState>(
    `onboarding:${user.id}`,
    {
      selectedPlatform: undefined,
    }
  );

  const setOnboardingLocalConfig = useCallback(
    (newState: Partial<LocalState>) => {
      setLocalStorageState({...localStorageState, ...newState});
    },
    [localStorageState, setLocalStorageState]
  );

  return [localStorageState, setOnboardingLocalConfig];
}
