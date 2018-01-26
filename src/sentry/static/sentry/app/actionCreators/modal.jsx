import React from 'react';

import ModalActions from '../actions/modalActions';

/**
 * Show a modal
 */
export function openModal(renderer, options) {
  ModalActions.openModal(renderer, options);
}

/**
 * Close modal
 */
export function closeModal() {
  ModalActions.closeModal();
}

export function openSudo({retryRequest, onClose} = {}) {
  import('../components/modals/sudoModal')
    .then(mod => mod.default)
    .then(SudoModal =>
      openModal(deps => <SudoModal {...deps} retryRequest={retryRequest} />, {onClose})
    );
}
