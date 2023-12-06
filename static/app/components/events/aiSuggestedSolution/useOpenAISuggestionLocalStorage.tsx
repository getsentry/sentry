import {useCallback} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

type LocalState = {
  individualConsent: boolean;
};

export function useOpenAISuggestionLocalStorage(): [
  LocalState,
  (newState: Partial<LocalState>) => void,
] {
  const user = ConfigStore.get('user');

  const [localStorageState, setLocalStorageState] = useLocalStorageState<LocalState>(
    `open-ai-suggestion:${user.id}`,
    {
      // agree forward data to OpenAI
      individualConsent: false,
    }
  );

  const setSuggestedSolutionLocalConfig = useCallback(
    (newState: Partial<LocalState>) => {
      setLocalStorageState({...localStorageState, ...newState});
    },
    [localStorageState, setLocalStorageState]
  );

  return [localStorageState, setSuggestedSolutionLocalConfig];
}
