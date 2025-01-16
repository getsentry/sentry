import type {ModalOptions} from 'sentry/actionCreators/modal';
import ModalStore from 'sentry/stores/modalStore';

interface OpenSudoModalOptions extends ModalOptions {
  closeButton?: boolean;
  isSuperuser?: boolean;
  needsReload?: boolean;
  onClose?: () => void;
  retryRequest?: () => Promise<any>;
  sudo?: boolean;
}

export async function openSudo({
  onClose,
  closeEvents,
  ...args
}: OpenSudoModalOptions = {}) {
  const mod = await import('sentry/components/modals/sudoModal');
  const {default: Modal} = mod;

  ModalStore.openModal(deps => <Modal {...deps} {...args} />, {onClose, closeEvents});
}
