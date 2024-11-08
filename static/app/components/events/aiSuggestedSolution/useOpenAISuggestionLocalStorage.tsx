import {useCallback} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useUser} from 'sentry/utils/useUser';

type LocalState = {
  individualConsent: boolean;
};

export function useOpenAISuggestionLocalStorage(): [
  LocalState,
  (newState: Partial<LocalState>) => void,
] {
  const user = useUser();

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
