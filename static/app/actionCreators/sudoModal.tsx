import ModalStore from 'sentry/stores/modalStore';

type OpenSudoModalOptions = {
  isSuperuser?: boolean;
  needsReload?: boolean;
  onClose?: () => void;
  retryRequest?: () => Promise<any>;
  sudo?: boolean;
};

export async function openSudo({onClose, ...args}: OpenSudoModalOptions = {}) {
  const mod = await import('sentry/components/modals/sudoModal');
  const {default: Modal} = mod;

  ModalStore.openModal(deps => <Modal {...deps} {...args} />, {onClose});
}
