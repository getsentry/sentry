import type {ModalTypes} from 'sentry/components/globalModal';
import type {CreateReleaseIntegrationModalOptions} from 'sentry/components/modals/createReleaseIntegrationModal';
import type {DashboardWidgetQuerySelectorModalOptions} from 'sentry/components/modals/dashboardWidgetQuerySelectorModal';
import type {SaveQueryModalProps} from 'sentry/components/modals/explore/saveQueryModal';
import type {ImportDashboardFromFileModalProps} from 'sentry/components/modals/importDashboardFromFileModal';
import type {InsightChartModalOptions} from 'sentry/components/modals/insightChartModal';
import type {InviteRow} from 'sentry/components/modals/inviteMembersModal/types';
import type {PrivateGamingSdkAccessModalProps} from 'sentry/components/modals/privateGamingSdkAccessModal';
import type {ReprocessEventModalOptions} from 'sentry/components/modals/reprocessEventModal';
import type {TokenRegenerationConfirmationModalProps} from 'sentry/components/modals/tokenRegenerationConfirmationModal';
import type {AddToDashboardModalProps} from 'sentry/components/modals/widgetBuilder/addToDashboardModal';
import type {LinkToDashboardModalProps} from 'sentry/components/modals/widgetBuilder/linkToDashboardModal';
import type {WidgetViewerModalOptions} from 'sentry/components/modals/widgetViewerModal';
import type {ConsoleModalProps} from 'sentry/components/onboarding/consoleModal';
import type {Category} from 'sentry/components/platformPicker';
import ModalStore from 'sentry/stores/modalStore';
import type {CustomRepoType} from 'sentry/types/debugFiles';
import type {Event} from 'sentry/types/event';
import type {IssueOwnership} from 'sentry/types/group';
import type {MissingMember, Organization, OrgRole, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Theme} from 'sentry/utils/theme';

export type ModalOptions = ModalTypes['options'];
export type ModalRenderProps = ModalTypes['renderProps'];
type ModalRenderPropKeys = keyof ModalRenderProps;

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
  initialData?: Array<Partial<InviteRow>>;
  onClose?: () => void;
  source?: string;
};

export async function openEmailVerification({
  onClose,
  ...args
}: EmailVerificationModalOptions = {}) {
  const {default: Modal} = await import(
    'sentry/components/modals/emailVerificationModal'
  );

  openModal(deps => <Modal {...deps} {...args} />, {onClose});
}

interface OpenDiffModalOptions
  extends Omit<
    React.ComponentProps<typeof import('sentry/components/modals/diffModal').default>,
    ModalRenderPropKeys
  > {
  project: Project;
}

export async function openDiffModal(options: OpenDiffModalOptions) {
  const {default: Modal, modalCss} = await import('sentry/components/modals/diffModal');

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
  const {default: Modal} = await import('sentry/components/modals/createTeamModal');

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
   * Theme object
   */
  theme: Theme;
  /**
   * Suggestions will be created from the current event
   */
  eventData?: Event;
};

/**
 * Open the edit ownership modal within issue details
 */
export async function openIssueOwnershipRuleModal(
  options: CreateOwnershipRuleModalOptions
) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/issueOwnershipRuleModal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {
    modalCss: modalCss(options.theme),
  });
}

export type EditOwnershipRulesModalOptions = {
  onSave: (ownership: IssueOwnership) => void;
  organization: Organization;
  ownership: IssueOwnership;
  project: Project;
  theme: Theme;
};

export async function openEditOwnershipRules(options: EditOwnershipRulesModalOptions) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/editOwnershipRulesModal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss: modalCss(options.theme),
  });
}

export async function openCommandPaletteDeprecated(options: ModalOptions = {}) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/deprecatedCommandPalette'
  );

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openCommandPalette(options: ModalOptions = {}) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/commandPalette/ui/modal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type RecoveryModalOptions = {
  authenticatorName: string;
};

export async function openRecoveryOptions(options: RecoveryModalOptions) {
  const {default: Modal} = await import('sentry/components/modals/recoveryOptionsModal');

  openModal(deps => <Modal {...deps} {...options} />);
}

export type TeamAccessRequestModalOptions = {
  memberId: string;
  orgId: string;
  teamId: string;
};

export async function openTeamAccessRequestModal(options: TeamAccessRequestModalOptions) {
  const {default: Modal} = await import(
    'sentry/components/modals/teamAccessRequestModal'
  );

  openModal(deps => <Modal {...deps} {...options} />);
}

type HelpSearchModalOptions = {
  organization?: Organization;
  placeholder?: string;
};

export async function openHelpSearchModal(options?: HelpSearchModalOptions) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/helpSearchModal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type DebugFileSourceModalOptions = {
  onSave: (data: Record<string, any>) => Promise<void>;
  organization: Organization;
  sourceType: CustomRepoType;
  onClose?: () => void;
  sourceConfig?: Record<string, any>;
};

export async function openDebugFileSourceModal({
  onClose,
  ...restOptions
}: DebugFileSourceModalOptions) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/debugFileCustomRepository'
  );

  openModal(deps => <Modal {...deps} {...restOptions} />, {
    modalCss,
    onClose,
  });
}

export async function openInviteMembersModal({
  onClose,
  ...args
}: InviteMembersModalOptions = {}) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/inviteMembersModal'
  );

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
  const {InviteMissingMembersModal, modalCss} = await import(
    'sentry/components/modals/inviteMissingMembersModal'
  );

  openModal(deps => <InviteMissingMembersModal {...deps} {...args} />, {
    modalCss,
    onClose,
  });
}

export async function openAddToDashboardModal(options: AddToDashboardModalProps) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/widgetBuilder/addToDashboardModal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
}

export async function openLinkToDashboardModal(options: LinkToDashboardModalProps) {
  const {LinkToDashboardModal, modalCss} = await import(
    'sentry/components/modals/widgetBuilder/linkToDashboardModal'
  );

  openModal(deps => <LinkToDashboardModal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
}

export async function openImportDashboardFromFileModal(
  options: ImportDashboardFromFileModalProps
) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/importDashboardFromFileModal'
  );

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
  const {default: Modal, modalCss} = await import('sentry/components/modals/demoSignUp');

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

type DemoEndModalOptions = {
  tour: string;
};

export async function demoEndModal(options: DemoEndModalOptions) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/demoEndModal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openDashboardWidgetQuerySelectorModal(
  options: DashboardWidgetQuerySelectorModalOptions
) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/dashboardWidgetQuerySelectorModal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'escape-key',
    modalCss,
  });
}

export async function openWidgetViewerModal({
  onClose,
  ...options
}: WidgetViewerModalOptions & {onClose?: () => void}) {
  const {
    default: Modal,
    modalCss,
    backdropCss,
  } = await import('sentry/components/modals/widgetViewerModal');

  openModal(deps => <Modal {...deps} {...options} />, {
    closeEvents: 'none',
    modalCss,
    backdropCss,
    onClose,
  });
}

export async function openCreateNewIntegrationModal() {
  const {default: Modal} = await import(
    'sentry/components/modals/createNewIntegrationModal'
  );

  openModal(deps => <Modal {...deps} />);
}

export async function openCreateReleaseIntegration(
  options: CreateReleaseIntegrationModalOptions
) {
  const {default: Modal} = await import(
    'sentry/components/modals/createReleaseIntegrationModal'
  );

  openModal(deps => <Modal {...deps} {...options} />);
}

type NavigateToExternalLinkModalOptions = {
  linkText: string;
};

export async function openNavigateToExternalLinkModal(
  options: NavigateToExternalLinkModalOptions
) {
  const {default: Modal} = await import(
    'sentry/components/modals/navigateToExternalLinkModal'
  );

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function openProjectCreationModal(options: {defaultCategory: Category}) {
  const {default: Modal, modalCss} = await import(
    'sentry/components/modals/projectCreationModal'
  );

  openModal(deps => <Modal {...deps} {...options} />, {modalCss});
}

export async function openConsoleModal(
  options: ConsoleModalProps & {
    onClose?: () => void;
  }
) {
  const {ConsoleModal: Modal, modalCss} = await import(
    'sentry/components/onboarding/consoleModal'
  );
  openModal(deps => <Modal {...deps} {...options} />, {
    modalCss,
    onClose: options.onClose,
  });
}

export async function openBulkEditMonitorsModal({onClose, ...options}: ModalOptions) {
  const {BulkEditMonitorsModal, modalCss} = await import(
    'sentry/components/modals/bulkEditMonitorsModal'
  );

  openModal(deps => <BulkEditMonitorsModal {...deps} {...options} />, {
    modalCss,
    onClose,
  });
}

export async function openInsightChartModal(options: InsightChartModalOptions) {
  const {
    default: Modal,
    modalCss,
    fullscreenModalCss,
  } = await import('sentry/components/modals/insightChartModal');

  openModal(deps => <Modal {...deps} {...options} />, {
    modalCss: options.fullscreen ? fullscreenModalCss : modalCss,
  });
}

export async function openAddTempestCredentialsModal(options: {
  organization: Organization;
  origin: 'onboarding' | 'project-creation' | 'project-settings';
  project: Project;
}) {
  const {default: Modal} = await import(
    'sentry/components/modals/addTempestCredentialsModal'
  );

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function openSaveQueryModal(options: SaveQueryModalProps) {
  const {default: Modal} = await import(
    'sentry/components/modals/explore/saveQueryModal'
  );

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function openTokenRegenerationConfirmationModal(
  options: TokenRegenerationConfirmationModalProps
) {
  const {default: Modal} = await import(
    'sentry/components/modals/tokenRegenerationConfirmationModal'
  );

  openModal(deps => <Modal {...deps} {...options} />);
}

export async function openPrivateGamingSdkAccessModal(
  options: PrivateGamingSdkAccessModalProps
) {
  const {PrivateGamingSdkAccessModal} = await import(
    'sentry/components/modals/privateGamingSdkAccessModal'
  );

  openModal(deps => <PrivateGamingSdkAccessModal {...deps} {...options} />);
}

type InsightInfoModalOptions = {
  children: React.ReactNode;
  title: string;
};

export async function openInsightInfoModal(options: InsightInfoModalOptions) {
  const {InsightInfoModal} = await import(
    'sentry/views/preprod/buildDetails/main/insights/insightInfoModal'
  );

  openModal(deps => <InsightInfoModal {...deps} {...options} />);
}
