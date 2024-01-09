import type {ModalTypes} from 'sentry/components/globalModal';
import type {CreateNewIntegrationModalOptions} from 'sentry/components/modals/createNewIntegrationModal';
import type {CreateReleaseIntegrationModalOptions} from 'sentry/components/modals/createReleaseIntegrationModal';
import type {DashboardWidgetQuerySelectorModalOptions} from 'sentry/components/modals/dashboardWidgetQuerySelectorModal';
import type {InviteRow} from 'sentry/components/modals/inviteMembersModal/types';
import type {ReprocessEventModalOptions} from 'sentry/components/modals/reprocessEventModal';
import type {OverwriteWidgetModalProps} from 'sentry/components/modals/widgetBuilder/overwriteWidgetModal';
import type {WidgetViewerModalOptions} from 'sentry/components/modals/widgetViewerModal';
import ModalStore from 'sentry/stores/modalStore';
import type {
  Event,
  Group,
  IssueOwnership,
  MissingMember,
  Organization,
  OrgRole,
  Project,
  SentryApp,
  Team,
} from 'sentry/types';
import type {AppStoreConnectStatusData, CustomRepoType} from 'sentry/types/debugFiles';

export type ModalOptions = ModalTypes['options'];
export type ModalRenderProps = ModalTypes['renderProps'];

/**
 * Show a modal
 */
export function openModal(
  renderer: (renderProps: ModalRenderProps) => React.ReactNode,
  options?: ModalOptions
) {
  ModalStore.openModal(renderer, options ?? {});
}

/**
 * Close modal
 */
export function closeModal() {
  ModalStore.closeModal();
}

type EmailVerificationModalOptions = {
  actionMessage?: string;
  emailVerified?: boolean;
  onClose?: () => void;
};

type InviteMembersModalOptions = {
  initialData?: Partial<InviteRow>[];
  onClose?: () => void;
  source?: string;
};

export async function openEmailVerification({
  onClose,
  ...args
}: EmailVerificationModalOptions = {}) {
  const mod = await import('sentry/components/modals/emailVerificationModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {onClose});
}

type OpenDiffModalOptions = {
  baseIssueId: Group['id'];
  orgId: Organization['id'];
  project: Project;
  targetIssueId: string;
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
  onClose?: (team: Team) => void;
  /**
   * An initial project to add the team to. This may be deprecated soon as we may add a project selection inside of the modal flow
   */
  project?: Project;
};

export async function openCreateTeamModal(options: CreateTeamModalOptions) {
  const mod = await import('sentry/components/modals/createTeamModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

type CreateOwnershipRuleModalOptions = {
  issueId: string;
  /**
   * The organization to create a rules for
   */
  organization: Organization;
  /**
   * The project to create a rules for
   */
  project: Project;
  /**
   * Suggestions will be created from the current event
   */
  eventData?: Event;
};

export type EditOwnershipRulesModalOptions = {
  onSave: (text: string | null) => void;
  organization: Organization;
  ownership: IssueOwnership;
  project: Project;
};

/**
 * Open the edit ownership modal within issue details
 */
export async function openIssueOwnershipRuleModal(
  options: CreateOwnershipRuleModalOptions
) {
  const mod = await import('sentry/components/modals/issueOwnershipRuleModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openEditOwnershipRules(options: EditOwnershipRulesModalOptions) {
  const mod = await import('sentry/components/modals/editOwnershipRulesModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
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
  orgId: string;
  teamId: string;
};

export async function openTeamAccessRequestModal(options: TeamAccessRequestModalOptions) {
  const mod = await import('sentry/components/modals/teamAccessRequestModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
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
  isInstalled: boolean;
  onInstall: () => Promise<void>;
  organization: Organization;
  sentryApp: SentryApp;
  onCloseModal?: () => void; // used for analytics
};

type DebugFileSourceModalOptions = {
  appStoreConnectSourcesQuantity: number;
  onSave: (data: Record<string, any>) => Promise<void>;
  organization: Organization;
  sourceType: CustomRepoType;
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
}: InviteMembersModalOptions = {}) {
  const mod = await import('sentry/components/modals/inviteMembersModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {modalCss, onClose});
}

type InviteMissingMembersModalOptions = {
  allowedRoles: OrgRole[];
  missingMembers: MissingMember[];
  onClose: () => void;
  organization: Organization;
};

export async function openInviteMissingMembersModal({
  onClose,
  ...args
}: InviteMissingMembersModalOptions) {
  const mod = await import('sentry/components/modals/inviteMissingMembersModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {modalCss, onClose});
}

export async function openWidgetBuilderOverwriteModal(
  options: OverwriteWidgetModalProps
) {
  const mod = await import('sentry/components/modals/widgetBuilder/overwriteWidgetModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
}

export async function openAddToDashboardModal(options) {
  const mod = await import('sentry/components/modals/widgetBuilder/addToDashboardModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
}

export async function openImportDashboardFromFileModal(options) {
  const mod = await import('sentry/components/modals/importDashboardFromFileModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
}

export async function openCreateDashboardFromScratchpad(options) {
  const mod = await import('sentry/components/modals/createDashboardFromScratchpadModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
}

export async function openReprocessEventModal({
  onClose,
  ...options
}: ReprocessEventModalOptions & {onClose?: () => void}) {
  const {ReprocessingEventModal} = await import(
    'sentry/components/modals/reprocessEventModal'
  );

  openModal(deps => <ReprocessingEventModal {...deps} {...options} />, {onClose});
}

export async function demoSignupModal(options: ModalOptions = {}) {
  const mod = await import('sentry/components/modals/demoSignUp');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export type DemoEndModalOptions = {
  orgSlug: string | null;
  tour: string;
};

export async function demoEndModal(options: DemoEndModalOptions) {
  const mod = await import('sentry/components/modals/demoEndModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openDashboardWidgetQuerySelectorModal(
  options: DashboardWidgetQuerySelectorModalOptions
) {
  const mod = await import('sentry/components/modals/dashboardWidgetQuerySelectorModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
}

export async function openWidgetViewerModal({
  onClose,
  ...options
}: WidgetViewerModalOptions & {onClose?: () => void}) {
  const mod = await import('sentry/components/modals/widgetViewerModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
    onClose,
  });
}

export async function openCreateNewIntegrationModal(
  options: CreateNewIntegrationModalOptions
) {
  const mod = await import('sentry/components/modals/createNewIntegrationModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function openCreateReleaseIntegration(
  options: CreateReleaseIntegrationModalOptions
) {
  const mod = await import('sentry/components/modals/createReleaseIntegrationModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}

export type NavigateToExternalLinkModalOptions = {
  linkText: string;
};

export async function openNavigateToExternalLinkModal(
  options: NavigateToExternalLinkModalOptions
) {
  const mod = await import('sentry/components/modals/navigateToExternalLinkModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...options} />);
}
