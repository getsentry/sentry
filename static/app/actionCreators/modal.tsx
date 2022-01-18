import * as React from 'react';

import ModalActions from 'sentry/actions/modalActions';
import type {ModalTypes} from 'sentry/components/globalModal';
import type {DashboardWidgetModalOptions} from 'sentry/components/modals/addDashboardWidgetModal';
import {DashboardWidgetLibraryModalOptions} from 'sentry/components/modals/dashboardWidgetLibraryModal';
import type {DashboardWidgetQuerySelectorModalOptions} from 'sentry/components/modals/dashboardWidgetQuerySelectorModal';
import {InviteRow} from 'sentry/components/modals/inviteMembersModal/types';
import type {ReprocessEventModalOptions} from 'sentry/components/modals/reprocessEventModal';
import {
  Group,
  IssueOwnership,
  Organization,
  Project,
  SentryApp,
  Team,
} from 'sentry/types';
import {AppStoreConnectStatusData, CustomRepoType} from 'sentry/types/debugFiles';
import {Event} from 'sentry/types/event';

export type ModalOptions = ModalTypes['options'];
export type ModalRenderProps = ModalTypes['renderProps'];

/**
 * Show a modal
 */
export function openModal(
  renderer: (renderProps: ModalRenderProps) => React.ReactNode,
  options?: ModalOptions
) {
  ModalActions.openModal(renderer, options ?? {});
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
  const mod = await import('sentry/components/modals/sudoModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {onClose});
}

export async function openEmailVerification({
  onClose,
  ...args
}: emailVerificationModalOptions = {}) {
  const mod = await import('sentry/components/modals/emailVerificationModal');
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
  const mod = await import('sentry/components/modals/diffModal');
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
  const mod = await import('sentry/components/modals/createTeamModal');
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
  const mod = await import('sentry/components/modals/createOwnershipRuleModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openEditOwnershipRules(options: EditOwnershipRulesModalOptions) {
  const mod = await import('sentry/components/modals/editOwnershipRulesModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {backdrop: 'static', modalCss});
}

export async function openCommandPalette(options: ModalOptions = {}) {
  const mod = await import('sentry/components/modals/commandPalette');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type RecoveryModalOptions = {
  authenticatorName: string;
};

export async function openRecoveryOptions(options: RecoveryModalOptions) {
  const mod = await import('sentry/components/modals/recoveryOptionsModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

export type TeamAccessRequestModalOptions = {
  memberId: string;
  teamId: string;
  orgId: string;
};

export async function openTeamAccessRequestModal(options: TeamAccessRequestModalOptions) {
  const mod = await import('sentry/components/modals/teamAccessRequestModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function redirectToProject(newProjectSlug: string) {
  const mod = await import('sentry/components/modals/redirectToProject');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
}

type HelpSearchModalOptions = {
  organization?: Organization;
  placeholder?: string;
};

export async function openHelpSearchModal(options?: HelpSearchModalOptions) {
  const mod = await import('sentry/components/modals/helpSearchModal');
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
  organization: Organization;
  sourceType: CustomRepoType;
  appStoreConnectSourcesQuantity: number;
  onSave: (data: Record<string, any>) => Promise<void>;
  appStoreConnectStatusData?: AppStoreConnectStatusData;
  onClose?: () => void;
  sourceConfig?: Record<string, any>;
};

export async function openDebugFileSourceModal({
  onClose,
  ...restOptions
}: DebugFileSourceModalOptions) {
  const mod = await import('sentry/components/modals/debugFileCustomRepository');

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
  const mod = await import('sentry/components/modals/inviteMembersModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {modalCss, onClose});
}

export async function openAddDashboardWidgetModal(options: DashboardWidgetModalOptions) {
  const mod = await import('sentry/components/modals/addDashboardWidgetModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {backdrop: 'static', modalCss});
}

export async function openReprocessEventModal({
  onClose,
  ...options
}: ReprocessEventModalOptions & {onClose?: () => void}) {
  const mod = await import('sentry/components/modals/reprocessEventModal');

  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {onClose});
}

export async function demoSignupModal(options: ModalOptions = {}) {
  const mod = await import('sentry/components/modals/demoSignUp');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openDashboardWidgetQuerySelectorModal(
  options: DashboardWidgetQuerySelectorModalOptions
) {
  const mod = await import('sentry/components/modals/dashboardWidgetQuerySelectorModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {backdrop: 'static', modalCss});
}

export async function openDashboardWidgetLibraryModal(
  options: DashboardWidgetLibraryModalOptions
) {
  const mod = await import('sentry/components/modals/dashboardWidgetLibraryModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {backdrop: 'static', modalCss});
}
