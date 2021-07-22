import * as React from 'react';

import ModalActions from 'app/actions/modalActions';
import GlobalModal from 'app/components/globalModal';
import type {DashboardWidgetModalOptions} from 'app/components/modals/addDashboardWidgetModal';
import {InviteRow} from 'app/components/modals/inviteMembersModal/types';
import type {ReprocessEventModalOptions} from 'app/components/modals/reprocessEventModal';
import {AppStoreConnectContextProps} from 'app/components/projects/appStoreConnectContext';
import {Group, IssueOwnership, Organization, Project, SentryApp, Team} from 'app/types';
import {CustomRepoType} from 'app/types/debugFiles';
import {Event} from 'app/types/event';

type ModalProps = Required<React.ComponentProps<typeof GlobalModal>>;

export type ModalOptions = ModalProps['options'];
export type ModalRenderProps = Parameters<NonNullable<ModalProps['children']>>[0];

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

type emailVerificationModalOptions = {
  onClose?: () => void;
  emailVerified?: boolean;
  actionMessage?: string;
};

type inviteMembersModalOptions = {
  onClose?: () => void;
  initialData?: Partial<InviteRow>[];
  source?: string;
};

export async function openSudo({onClose, ...args}: OpenSudoModalOptions = {}) {
  const mod = await import('app/components/modals/sudoModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {onClose});
}

export async function openEmailVerification({
  onClose,
  ...args
}: emailVerificationModalOptions = {}) {
  const mod = await import('app/components/modals/emailVerificationModal');
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
  const mod = await import('app/components/modals/diffModal');
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
  const mod = await import('app/components/modals/createTeamModal');
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

export type EditOwnershipRulesModalOptions = {
  organization: Organization;
  project: Project;
  ownership: IssueOwnership;
  onSave: (text: string | null) => void;
};

export async function openCreateOwnershipRule(options: CreateOwnershipRuleModalOptions) {
  const mod = await import('app/components/modals/createOwnershipRuleModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openEditOwnershipRules(options: EditOwnershipRulesModalOptions) {
  const mod = await import('app/components/modals/editOwnershipRulesModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {backdrop: 'static', modalCss});
}

export async function openCommandPalette(options: ModalOptions = {}) {
  const mod = await import('app/components/modals/commandPalette');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type RecoveryModalOptions = {
  authenticatorName: string;
};

export async function openRecoveryOptions(options: RecoveryModalOptions) {
  const mod = await import('app/components/modals/recoveryOptionsModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

export type TeamAccessRequestModalOptions = {
  memberId: string;
  teamId: string;
  orgId: string;
};

export async function openTeamAccessRequestModal(options: TeamAccessRequestModalOptions) {
  const mod = await import('app/components/modals/teamAccessRequestModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function redirectToProject(newProjectSlug: string) {
  const mod = await import('app/components/modals/redirectToProject');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
}

type HelpSearchModalOptions = {
  organization?: Organization;
  placeholder?: string;
};

export async function openHelpSearchModal(options?: HelpSearchModalOptions) {
  const mod = await import('app/components/modals/helpSearchModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export type SentryAppDetailsModalOptions = {
  sentryApp: SentryApp;
  isInstalled: boolean;
  onInstall: () => Promise<void>;
  organization: Organization;
  onCloseModal?: () => void; // used for analytics
};

type DebugFileSourceModalOptions = {
  sourceType: CustomRepoType;
  onSave: (data: Record<string, any>) => Promise<void>;
  appStoreConnectContext?: AppStoreConnectContextProps;
  onClose?: () => void;
  sourceConfig?: Record<string, any>;
};

export async function openDebugFileSourceModal({
  onClose,
  ...restOptions
}: DebugFileSourceModalOptions) {
  const mod = await import(
    /* webpackChunkName: "DebugFileCustomRepository" */ 'app/components/modals/debugFileCustomRepository'
  );

  const {default: Modal, modalCss} = mod;
  openModal(deps => <Modal {...deps} {...restOptions} />, {
    modalCss,
    onClose,
  });
}

export async function openInviteMembersModal({
  onClose,
  ...args
}: inviteMembersModalOptions = {}) {
  const mod = await import('app/components/modals/inviteMembersModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {modalCss, onClose});
}

export async function openAddDashboardWidgetModal(options: DashboardWidgetModalOptions) {
  const mod = await import('app/components/modals/addDashboardWidgetModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {backdrop: 'static', modalCss});
}

export async function openReprocessEventModal({
  onClose,
  ...options
}: ReprocessEventModalOptions & {onClose?: () => void}) {
  const mod = await import('app/components/modals/reprocessEventModal');

  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {onClose});
}
