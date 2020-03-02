import React from 'react';
import {css} from '@emotion/core';
import {ModalHeader, ModalBody, ModalFooter} from 'react-bootstrap';

import ModalActions from 'app/actions/modalActions';
import {
  Integration,
  IntegrationProvider,
  Organization,
  SentryApp,
  Project,
} from 'app/types';

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

type OpenSudoModalOptions = {
  onClose?: () => void;
  superuser?: boolean;
  sudo?: boolean;
  retryRequest?: () => Promise<any>;
};

export async function openSudo({onClose, ...args}: OpenSudoModalOptions = {}) {
  const mod = await import(
    /* webpackChunkName: "SudoModal" */ 'app/components/modals/sudoModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {
    modalClassName: 'sudo-modal',
    onClose,
  });
}

export async function openDiffModal(options: ModalOptions) {
  const mod = await import(
    /* webpackChunkName: "DiffModal" */ 'app/components/modals/diffModal'
  );
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    modalCss,
  });
}

type CreateTeamModalOptions = {
  /**
   * The organization to create a team for
   */
  organization: Organization;
  /**
   * An initial project to add the team to. This may be deprecated soon as we may add a project selection inside of the modal flow
   */
  project?: Project;
};

export async function openCreateTeamModal(options: CreateTeamModalOptions) {
  const mod = await import(
    /* webpackChunkName: "CreateTeamModal" */ 'app/components/modals/createTeamModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    modalClassName: 'create-team-modal',
  });
}

type CreateOwnershipRuleModalOptions = {
  /**
   * The organization to create a rules for
   */
  organization: Organization;
  /**
   * The project to create a rules for
   */
  project: Project;
};

export async function openCreateOwnershipRule(options: CreateOwnershipRuleModalOptions) {
  const mod = await import(
    /* webpackChunkName: "CreateOwnershipRuleModal" */ 'app/components/modals/createOwnershipRuleModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    modalClassName: 'create-ownership-rule-modal',
  });
}

export async function openCommandPalette(options: ModalOptions = {}) {
  const mod = await import(
    /* webpackChunkName: "CommandPalette" */ 'app/components/modals/commandPalette'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    modalClassName: 'command-palette',
  });
}

export async function openRecoveryOptions(options: ModalOptions = {}) {
  const mod = await import(
    /* webpackChunkName: "RecoveryOptionsModal" */ 'app/components/modals/recoveryOptionsModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    modalClassName: 'recovery-options',
  });
}

export type TeamAccessRequestModalOptions = {
  memberId: string;
  teamId: string;
  orgId: string;
};

export async function openTeamAccessRequestModal(options: TeamAccessRequestModalOptions) {
  const mod = await import(
    /* webpackChunkName: "TeamAccessRequestModal" */ 'app/components/modals/teamAccessRequestModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    modalClassName: 'confirm-team-request',
  });
}

export type IntegrationDetailsModalOptions = {
  onAddIntegration: (integration: Integration) => void;
  provider: IntegrationProvider;
  organization: Organization;
  isInstalled: boolean; //used for analytics
  onCloseModal?: () => void; //used for analytics
};

export async function openIntegrationDetails(options: IntegrationDetailsModalOptions) {
  const mod = await import(
    /* webpackChunkName: "IntegrationDetailsModal" */ 'app/components/modals/integrationDetailsModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function redirectToProject(newProjectSlug: string) {
  const mod = await import(
    /* webpackChunkName: "RedirectToProjectModal" */ 'app/components/modals/redirectToProject'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
}

export async function openHelpSearchModal() {
  const mod = await import(
    /* webpackChunkName: "HelpSearchModal" */ 'app/components/modals/helpSearchModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} />, {
    modalClassName: 'help-search-modal',
  });
}

export type SentryAppDetailsModalOptions = {
  sentryApp: SentryApp;
  isInstalled: boolean;
  onInstall: () => Promise<void>;
  organization: Organization;
  onCloseModal?: () => void; //used for analytics
};

export async function openSentryAppDetailsModal(options: SentryAppDetailsModalOptions) {
  const mod = await import(
    /* webpackChunkName: "SentryAppDetailsModal" */ 'app/components/modals/sentryAppDetailsModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function openDebugFileSourceModal(options: ModalOptions = {}) {
  const mod = await import(
    /* webpackChunkName: "DebugFileSourceModal" */ 'app/components/modals/debugFileSourceModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    modalClassName: 'debug-file-source',
  });
}

export async function openInviteMembersModal(options = {}) {
  const mod = await import(
    /* webpackChunkName: "InviteMembersModal" */ 'app/components/modals/inviteMembersModal'
  );
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}
