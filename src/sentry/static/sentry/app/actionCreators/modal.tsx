import React from 'react';
// eslint-disable-next-line no-restricted-imports
import {Modal as BoostrapModal} from 'react-bootstrap';
import {css} from '@emotion/core';

import ModalActions from 'app/actions/modalActions';
import type {DashboardWidgetModalOptions} from 'app/components/modals/addDashboardWidgetModal';
import type {ReprocessEventModalOptions} from 'app/components/modals/reprocessEventModal';
import {DebugFileSource, Group, Organization, Project, SentryApp, Team} from 'app/types';
import {Event} from 'app/types/event';

export type ModalRenderProps = {
  closeModal: () => void;
  Header: typeof BoostrapModal.Header;
  Body: typeof BoostrapModal.Body;
  Footer: typeof BoostrapModal.Footer;
};

export type ModalOptions = {
  onClose?: () => void;
  modalCss?: ReturnType<typeof css>;
  modalClassName?: string;
  dialogClassName?: string;
  type?: string;
  backdrop?: BoostrapModal['props']['backdrop'];
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

  openModal(deps => <Modal {...deps} {...args} />, {onClose});
}

type OpenDiffModalOptions = {
  targetIssueId: string;
  project: Project;
  baseIssueId: Group['id'];
  orgId: Organization['id'];
  baseEventId?: Event['id'];
  targetEventId?: string;
};

export async function openDiffModal(options: OpenDiffModalOptions) {
  const mod = await import(
    /* webpackChunkName: "DiffModal" */ 'app/components/modals/diffModal'
  );
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
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
  onClose?: (team: Team) => void;
};

export async function openCreateTeamModal(options: CreateTeamModalOptions) {
  const mod = await import(
    /* webpackChunkName: "CreateTeamModal" */ 'app/components/modals/createTeamModal'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
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
  issueId: string;
};

export async function openCreateOwnershipRule(options: CreateOwnershipRuleModalOptions) {
  const mod = await import(
    /* webpackChunkName: "CreateOwnershipRuleModal" */ 'app/components/modals/createOwnershipRuleModal'
  );
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openCommandPalette(options: ModalOptions = {}) {
  const mod = await import(
    /* webpackChunkName: "CommandPalette" */ 'app/components/modals/commandPalette'
  );
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type RecoveryModalOptions = {
  authenticatorName: string;
};

export async function openRecoveryOptions(options: RecoveryModalOptions) {
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

export async function redirectToProject(newProjectSlug: string) {
  const mod = await import(
    /* webpackChunkName: "RedirectToProjectModal" */ 'app/components/modals/redirectToProject'
  );
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
}

type HelpSearchModalOptions = {
  organization?: Organization;
  placeholder?: string;
};

export async function openHelpSearchModal(options?: HelpSearchModalOptions) {
  const mod = await import(
    /* webpackChunkName: "HelpSearchModal" */ 'app/components/modals/helpSearchModal'
  );
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export type SentryAppDetailsModalOptions = {
  sentryApp: SentryApp;
  isInstalled: boolean;
  onInstall: () => Promise<void>;
  organization: Organization;
  onCloseModal?: () => void; //used for analytics
};

type DebugFileSourceModalOptions = {
  sourceType: DebugFileSource;
  onSave: (data: Record<string, string>) => void;
  sourceConfig?: Record<string, string>;
};

export async function openDebugFileSourceModal(options: DebugFileSourceModalOptions) {
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

export async function openAddDashboardWidgetModal(options: DashboardWidgetModalOptions) {
  const mod = await import(
    /* webpackChunkName: "AddDashboardWidgetModal" */ 'app/components/modals/addDashboardWidgetModal'
  );
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {backdrop: 'static', modalCss});
}

export async function openReprocessEventModal({
  onClose,
  ...options
}: ReprocessEventModalOptions & {onClose?: () => void}) {
  const mod = await import(
    /* webpackChunkName: "ReprocessEventModal" */ 'app/components/modals/reprocessEventModal'
  );

  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {onClose});
}
