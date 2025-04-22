import type {ModalOptions} from 'sentry/actionCreators/modal';
import ModalStore from 'sentry/stores/modalStore';

type OpenSudoModalOptions = ModalOptions & {
  closeButton?: boolean;
  isSuperuser?: boolean;
  needsReload?: boolean;
  onClose?: () => void;
  retryRequest?: () => Promise<any>;
  sudo?: boolean;
};

export async function openSudo({
  onClose,
  closeEvents,
  ...args
}: OpenSudoModalOptions = {}) {
  const {default: Modal} = await import('sentry/components/modals/sudoModal');

  ModalStore.openModal(deps => <Modal {...deps} {...args} />, {onClose, closeEvents});
}
