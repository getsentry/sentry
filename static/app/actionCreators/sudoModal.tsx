import {openModal, type ModalOptions} from 'sentry/actionCreators/modal';

type OpenSudoModalOptions = ModalOptions & {
  accessMode?: 'sudo' | 'superuser' | 'staff';
  closeButton?: boolean;
  onClose?: () => void;
  orgSlug?: string;
  retryRequest?: () => Promise<any>;
};

export async function openSudo({
  onClose,
  closeEvents,
  ...args
}: OpenSudoModalOptions = {}) {
  const {SudoModal} = await import('sentry/components/modals/sudoModal');

  openModal(deps => <SudoModal {...deps} {...args} />, {onClose, closeEvents});
}
