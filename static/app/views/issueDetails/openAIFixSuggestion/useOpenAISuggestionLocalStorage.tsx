import {useCallback} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export function useOpenAISuggestionLocalStorage(): [
  boolean,
  (agreedForwardDataToOpenAI: boolean) => void
] {
  const user = ConfigStore.get('user');

  const [localStorageState, setLocalStorageState] = useLocalStorageState<{
    agreedForwardDataToOpenAI: boolean;
  }>(`open-ai-suggestion:${user.id}`, {
    agreedForwardDataToOpenAI: false,
  });

  const setAgreedForwardDataToOpenAI = useCallback(
    (agreedForwardDataToOpenAI: boolean) => {
      setLocalStorageState({agreedForwardDataToOpenAI});
    },
    [setLocalStorageState]
  );

  return [localStorageState.agreedForwardDataToOpenAI, setAgreedForwardDataToOpenAI];
}
