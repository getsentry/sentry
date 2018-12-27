import React from 'react';
import {css} from 'react-emotion';

import ModalActions from 'app/actions/modalActions';

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

export function openSudo({onClose, ...args} = {}) {
  import(/* webpackChunkName: "SudoModal" */ '../components/modals/sudoModal')
    .then(mod => mod.default)
    .then(SudoModal =>
      openModal(deps => <SudoModal {...deps} {...args} />, {
        modalClassName: 'sudo-modal',
        onClose,
      })
    );
}

export function openDiffModal(options) {
  import(/* webpackChunkName: "DiffModal" */ '../components/modals/diffModal')
    .then(mod => mod.default)
    .then(Modal => {
      // This is the only way to style the different Modal children
      const diffModalCss = css`
        .modal-dialog {
          display: flex;
          margin: 0;
          left: 10px;
          right: 10px;
          top: 10px;
          bottom: 10px;
          width: auto;
        }
        .modal-content {
          display: flex;
          flex: 1;
        }
        .modal-body {
          display: flex;
          overflow: hidden;
          flex: 1;
        }
      `;

      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: diffModalCss,
      });
    });
}

/**
 * @param Object options
 * @param Object options.organization The organization to create a team for
 * @param Object options.project (optional) An initial project to add the team to. This may be deprecated soon as
 * we may add a project selection inside of the modal flow
 */
export function openCreateTeamModal(options = {}) {
  import(/* webpackChunkName: "CreateTeamModal" */ '../components/modals/createTeamModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'create-team-modal',
      });
    });
}

/**
 * @param Object options.organization The organization to create a rules for
 * @param Object options.project The project to create a rules for
 */
export function openCreateOwnershipRule(options = {}) {
  import(/* webpackChunkName: "CreateOwnershipRuleModal" */ '../components/modals/createOwnershipRuleModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'create-ownership-rule-modal',
      });
    });
}

export function openCommandPalette(options = {}) {
  import(/* webpackChunkName: "CommandPalette" */ '../components/modals/commandPalette')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'command-palette',
      });
    });
}

export function openRecoveryOptions(options = {}) {
  import(/* webpackChunkName: "RecoveryOptionsModal" */ 'app/components/modals/recoveryOptionsModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'recovery-options',
      });
    });
}

/**
 * @param Object options.provider The integration provider to show the details for
 * @param Function options.onAddIntegration Called after a new integration is added
 */
export function openIntegrationDetails(options = {}) {
  import(/* webpackChunkName: "IntegrationDetailsModal" */ 'app/components/modals/integrationDetailsModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'integration-details',
      });
    });
}

export function redirectToProject(newProjectSlug) {
  import(/* webpackChunkName: "RedirectToProjectModal" */ 'app/components/modals/redirectToProject')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
    });
}

export function openDocsSearchModal() {
  import(/* webpackChunkName: "DocsSearchModal" */ 'app/components/modals/docsSearchModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} />, {
        modalClassName: 'docs-search-modal',
      });
    });
}
