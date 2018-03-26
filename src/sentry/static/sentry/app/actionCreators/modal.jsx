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
  import(/* webpackChunkName: "SudoModal" */ '../components/modals/sudoModal')
    .then(mod => mod.default)
    .then(SudoModal =>
      openModal(deps => <SudoModal {...deps} retryRequest={retryRequest} />, {onClose})
    );
}

export function openDiffModal(options) {
  import(/* webpackChunkName: "DiffModal" */ '../components/modals/diffModal')
    .then(mod => mod.default)
    .then(Modal =>
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'diff-modal',
      })
    );
}

export function openCreateTeamModal(options = {}) {
  import(/* webpackChunkName: "CreateTeamModal" */ '../components/modals/createTeamModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'create-team-modal',
      });
    });
}
