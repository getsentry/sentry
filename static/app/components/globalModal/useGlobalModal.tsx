import ModalStore from 'sentry/stores/modalStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export function useGlobalModal() {
  const modalStore = useLegacyStore(ModalStore);
  return {
    ...modalStore,
    visible: typeof modalStore.renderer === 'function',
  };
}
