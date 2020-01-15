import React from 'react';
import {css} from '@emotion/core';
import {ModalHeader, ModalBody, ModalFooter} from 'react-bootstrap';

import ModalActions from 'app/actions/modalActions';
import {Integration, IntegrationProvider, Organization, SentryApp} from 'app/types';

export type ModalRenderProps = {
  closeModal: () => void;
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
};

export type ModalOptions = {
  onClose?: () => void;
  modalCss?: ReturnType<typeof css>;
  modalClassName?: string;
  dialogClassName?: string;
  type?: string;
};

export type IntegrationDetailsModalOptions = {
  onAddIntegration: (integration: Integration) => void;
  provider: IntegrationProvider;
  organization: Organization;
  isInstalled: boolean; //used for analytics
};

export type SentryAppDetailsModalOptions = {
  sentryApp: SentryApp;
  isInstalled: boolean;
  onInstall: () => void;
  organization: Organization;
};

export type TeamAccessRequestModalOptions = {
  memberId: string;
  teamId: string;
  orgId: string;
};

/**
 * Show a modal
 */
export function openModal(
  renderer: (renderProps: ModalRenderProps) => React.ReactNode,
  options?: ModalOptions
) {
  ModalActions.openModal(renderer, options);
}

/**
 * Close modal
 */
export function closeModal() {
  ModalActions.closeModal();
}

export function openSudo({
  onClose,
  ...args
}: {
  onClose?: () => void;
  superuser?: boolean;
  sudo?: boolean;
  retryRequest?: () => Promise<any>;
} = {}) {
  import(/* webpackChunkName: "SudoModal" */ 'app/components/modals/sudoModal')
    .then(mod => mod.default)
    .then(SudoModal =>
      openModal(deps => <SudoModal {...deps} {...args} />, {
        modalClassName: 'sudo-modal',
        onClose,
      })
    );
}

export function openDiffModal(options: ModalOptions) {
  import(/* webpackChunkName: "DiffModal" */ 'app/components/modals/diffModal')
    .then(mod => mod.default)
    .then(Modal => {
      // This is the only way to style the different Modal children
      const modalCss = css`
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
        modalCss,
      });
    });
}

/**
 * @param Object options
 * @param Object options.organization The organization to create a team for
 * @param Object options.project (optional) An initial project to add the team to. This may be deprecated soon as
 * we may add a project selection inside of the modal flow
 */
export function openCreateTeamModal(options: ModalOptions = {}) {
  import(/* webpackChunkName: "CreateTeamModal" */ 'app/components/modals/createTeamModal')
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
export function openCreateOwnershipRule(options: ModalOptions = {}) {
  import(/* webpackChunkName: "CreateOwnershipRuleModal" */ 'app/components/modals/createOwnershipRuleModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'create-ownership-rule-modal',
      });
    });
}

export function openCommandPalette(options: ModalOptions = {}) {
  import(/* webpackChunkName: "CommandPalette" */ 'app/components/modals/commandPalette')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'command-palette',
      });
    });
}

export function openRecoveryOptions(options: ModalOptions = {}) {
  import(/* webpackChunkName: "RecoveryOptionsModal" */ 'app/components/modals/recoveryOptionsModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'recovery-options',
      });
    });
}

export function openTeamAccessRequestModal(options: TeamAccessRequestModalOptions) {
  import(/* webpackChunkName: "TeamAccessRequestModal" */ 'app/components/modals/teamAccessRequestModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'confirm-team-request',
      });
    });
}

/**
 * @param Object options.provider The integration provider to show the details for
 * @param Function options.onAddIntegration Called after a new integration is added
 */
export function openIntegrationDetails(options: IntegrationDetailsModalOptions) {
  import(/* webpackChunkName: "IntegrationDetailsModal" */ 'app/components/modals/integrationDetailsModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />);
    });
}

export function redirectToProject(newProjectSlug: string) {
  import(/* webpackChunkName: "RedirectToProjectModal" */ 'app/components/modals/redirectToProject')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
    });
}

export function openHelpSearchModal() {
  import(/* webpackChunkName: "HelpSearchModal" */ 'app/components/modals/helpSearchModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} />, {
        modalClassName: 'help-search-modal',
      });
    });
}

export function openSentryAppDetailsModal(options: SentryAppDetailsModalOptions) {
  import(/* webpackChunkName: "SentryAppDetailsModal" */ 'app/components/modals/sentryAppDetailsModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />);
    });
}

export function openDebugFileSourceModal(options: ModalOptions = {}) {
  import(/* webpackChunkName: "DebugFileSourceModal" */ 'app/components/modals/debugFileSourceModal')
    .then(mod => mod.default)
    .then(Modal => {
      openModal(deps => <Modal {...deps} {...options} />, {
        modalClassName: 'debug-file-source',
      });
    });
}

export async function openInviteMembersModal(options = {}) {
  const mod = await import(/* webpackChunkName: "InviteMembersModal" */ 'app/components/modals/inviteMembersModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}
