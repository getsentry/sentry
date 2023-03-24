import ConfigStore from 'sentry/stores/configStore';

export function useOpenAISuggestionLocalStorage() {
  const user = ConfigStore.get('user');

  const [localStorageState, setLocalStorageState] = useLocalStorageState<{
    agreedForwardDataToOpenAI: boolean;
  }>(`open-ai-suggestion:${user.id}`, {
    agreedForwardDataToOpenAI: false,
  });

  return [localStorageState, setLocalStorageState];
}
