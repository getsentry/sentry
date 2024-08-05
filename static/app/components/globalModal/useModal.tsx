import ModalStore from 'sentry/stores/modalStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export function useModal() {
  const modalStore = useLegacyStore(ModalStore);
  return {
    ...modalStore,
    visible: typeof modalStore.renderer === 'function',
  };
}
