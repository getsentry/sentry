import ModalStore from 'sentry/stores/modalStore';

type OpenSudoModalOptions = {
  closeButton?: boolean;
  closeEvents?: 'all' | 'none' | 'backdrop-click' | 'escape-key';
  isSuperuser?: boolean;
  needsReload?: boolean;
  onClose?: () => void;
  retryRequest?: () => Promise<any>;
  sudo?: boolean;
};

export async function openSudo({
  onClose,
  closeEvents = 'all',
  ...args
}: OpenSudoModalOptions = {}) {
  const mod = await import('sentry/components/modals/sudoModal');
  const {default: Modal} = mod;

  ModalStore.openModal(deps => <Modal {...deps} {...args} />, {onClose, closeEvents});
}
