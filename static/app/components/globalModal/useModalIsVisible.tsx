import ModalStore from 'sentry/stores/modalStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export function isGlobalModalVisible() {
  const {renderer} = useLegacyStore(ModalStore);
  return typeof renderer === 'function';
}
