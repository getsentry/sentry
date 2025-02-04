import type {Query} from 'history';

import type {OnboardingContextProps} from 'sentry/components/onboarding/onboardingContext';
import type {Category} from 'sentry/components/platformPicker';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';

import type {Group} from './group';
import type {Organization} from './organization';
import type {PlatformIntegration, PlatformKey, Project} from './project';
import type {AvatarUser} from './user';

export enum OnboardingTaskGroup {
  GETTING_STARTED = 'getting_started',
  BEYOND_BASICS = 'beyond_basics',
}

export enum OnboardingTaskKey {
  FIRST_PROJECT = 'create_project',
  FIRST_EVENT = 'send_first_event',
  INVITE_MEMBER = 'invite_member',
  SECOND_PLATFORM = 'setup_second_platform',
  RELEASE_TRACKING = 'setup_release_tracking',
  SOURCEMAPS = 'setup_sourcemaps',
  ALERT_RULE = 'setup_alert_rules',
  FIRST_TRANSACTION = 'setup_transactions',
  REAL_TIME_NOTIFICATIONS = 'setup_real_time_notifications',
  LINK_SENTRY_TO_SOURCE_CODE = 'link_sentry_to_source_code',
  SESSION_REPLAY = 'setup_session_replay',
  /// Demo New Walkthrough Tasks
  SIDEBAR_GUIDE = 'sidebar_guide',
  ISSUE_GUIDE = 'issue_guide',
  RELEASE_GUIDE = 'release_guide',
  PERFORMANCE_GUIDE = 'performance_guide',
}

export type OnboardingSupplementComponentProps = {
  task: OnboardingTask;
  onCompleteTask?: () => void;
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
   * The group that this task belongs to, e.g. basic and level up
   */
  group?: OnboardingTaskGroup;
  pendingTitle?: string;
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

export interface UpdatedTask extends Partial<Pick<OnboardingTask, 'status' | 'data'>> {
  task: OnboardingTask['task'];
  /**
   * Marks completion seen. This differs from the OnboardingTask
   * completionSeen type as that returns the date completion was seen.
   */
  completionSeen?: boolean;
}

export enum OnboardingProjectStatus {
  WAITING = 'waiting',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
}

export interface OnboardingSelectedSDK
  extends Pick<PlatformIntegration, 'language' | 'link' | 'name' | 'type'> {
  category: Category;
  key: PlatformKey;
}

export type OnboardingRecentCreatedProject = Project & {
  firstError: boolean;
  firstTransaction: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  olderThanOneHour: boolean;
  firstIssue?: Group;
};

export type OnboardingPlatformDoc = {html: string; link: string};
