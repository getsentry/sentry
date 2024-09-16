import type {Query} from 'history';

import type {OnboardingContextProps} from 'sentry/components/onboarding/onboardingContext';
import type {Category} from 'sentry/components/platformPicker';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';

import type {Group} from './group';
import type {Organization} from './organization';
import type {PlatformIntegration, PlatformKey, Project} from './project';
import type {AvatarUser} from './user';

export enum OnboardingTaskKey {
  FIRST_PROJECT = 'create_project',
  FIRST_EVENT = 'send_first_event',
  INVITE_MEMBER = 'invite_member',
  SECOND_PLATFORM = 'setup_second_platform',
  USER_CONTEXT = 'setup_user_context',
  RELEASE_TRACKING = 'setup_release_tracking',
  SOURCEMAPS = 'setup_sourcemaps',
  USER_REPORTS = 'setup_user_reports',
  ISSUE_TRACKER = 'setup_issue_tracker',
  ALERT_RULE = 'setup_alert_rules',
  FIRST_TRANSACTION = 'setup_transactions',
  METRIC_ALERT = 'setup_metric_alert_rules',
  USER_SELECTED_PROJECTS = 'setup_userselected_projects',
  /// Customized card that shows the selected integrations during onboarding
  INTEGRATIONS = 'integrations',
  /// Regular card that tells the user to setup integrations if no integrations were selected during onboarding
  FIRST_INTEGRATION = 'setup_integrations',
  SESSION_REPLAY = 'setup_session_replay',
  /// Demo New Walkthrough Tasks
  SIDEBAR_GUIDE = 'sidebar_guide',
  ISSUE_GUIDE = 'issue_guide',
  RELEASE_GUIDE = 'release_guide',
  PERFORMANCE_GUIDE = 'performance_guide',
}

export type OnboardingSupplementComponentProps = {
  onCompleteTask: () => void;
  task: OnboardingTask;
};

export type OnboardingCustomComponentProps = {
  onboardingContext: OnboardingContextProps;
  organization: Organization;
  projects: Project[];
  task: OnboardingTask;
};

interface OnboardingTaskDescriptorBase {
  description: string;
  /**
   * Should the onboarding task currently be displayed
   */
  display: boolean;
  /**
   * A list of require task keys that must have been completed before these
   * tasks may be completed.
   */
  requisites: OnboardingTaskKey[];
  /**
   * Can this task be skipped?
   */
  skippable: boolean;
  task: OnboardingTaskKey;
  title: string;
  /**
   * An extra component that may be rendered within the onboarding task item.
   */
  SupplementComponent?: React.ComponentType<OnboardingSupplementComponentProps>;
  /**
   * If a render function was provided, it will be used to render the entire card,
   * and the card will be rendered before any other cards regardless of completion status.
   * the render function is therefore responsible for determining the completion status
   * of the card by returning null when it's completed.
   *
   * Note that this should not be given a react component.
   */
  renderCard?: (props: OnboardingCustomComponentProps) => JSX.Element | null;
  /**
   * Joins with this task id for server-side onboarding state.
   * This allows you to create alias for exising onboarding tasks or create multiple
   * tasks for the same server-side task.
   */
  serverTask?: string;
}

interface OnboardingTypeDescriptorWithAction extends OnboardingTaskDescriptorBase {
  action: (props: InjectedRouter) => void;
  actionType: 'action';
}

interface OnboardingTypeDescriptorWithExternal extends OnboardingTaskDescriptorBase {
  actionType: 'external';
  location: string;
}

interface OnboardingTypeDescriptorWithAppLink extends OnboardingTaskDescriptorBase {
  actionType: 'app';
  location: string | {pathname: string; query?: Query};
}

export type OnboardingTaskDescriptor =
  | OnboardingTypeDescriptorWithAction
  | OnboardingTypeDescriptorWithExternal
  | OnboardingTypeDescriptorWithAppLink;

export interface OnboardingTaskStatus {
  status: 'skipped' | 'pending' | 'complete';
  task: OnboardingTaskKey;
  completionSeen?: string | boolean;
  data?: {[key: string]: string};
  dateCompleted?: string;
  user?: AvatarUser | null;
}

interface OnboardingTaskWithAction
  extends OnboardingTaskStatus,
    OnboardingTypeDescriptorWithAction {
  /**
   * Onboarding tasks that are currently incomplete and must be completed
   * before this task should be completed.
   */
  requisiteTasks: OnboardingTaskDescriptor[];
}

interface OnboardingTaskWithExternal
  extends OnboardingTaskStatus,
    OnboardingTypeDescriptorWithExternal {
  /**
   * Onboarding tasks that are currently incomplete and must be completed
   * before this task should be completed.
   */
  requisiteTasks: OnboardingTaskDescriptor[];
}

interface OnboardingTaskWithAppLink
  extends OnboardingTaskStatus,
    OnboardingTypeDescriptorWithAppLink {
  requisiteTasks: OnboardingTaskDescriptor[];
}

export type OnboardingTask =
  | OnboardingTaskWithAction
  | OnboardingTaskWithExternal
  | OnboardingTaskWithAppLink;

export enum OnboardingProjectStatus {
  WAITING = 'waiting',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
}

export type OnboardingSelectedSDK = {
  category: Category;
  key: PlatformKey;
  language: PlatformIntegration['language'];
  type: PlatformIntegration['type'];
};

export type OnboardingRecentCreatedProject = Project & {
  firstError: boolean;
  firstTransaction: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  olderThanOneHour: boolean;
  firstIssue?: Group;
};

export type OnboardingPlatformDoc = {html: string; link: string};
