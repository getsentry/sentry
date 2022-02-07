import {AvatarUser} from './user';

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
}

export type OnboardingSupplementComponentProps = {
  onCompleteTask: () => void;
  task: OnboardingTask;
};

export type OnboardingTaskDescriptor = {
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
} & (
  | {
      actionType: 'app' | 'external';
      location: string;
    }
  | {
      action: () => void;
      actionType: 'action';
    }
);

export type OnboardingTaskStatus = {
  status: 'skipped' | 'pending' | 'complete';
  task: OnboardingTaskKey;
  completionSeen?: string;
  data?: object;
  dateCompleted?: string;
  user?: AvatarUser | null;
};

export type OnboardingTask = OnboardingTaskStatus &
  OnboardingTaskDescriptor & {
    /**
     * Onboarding tasks that are currently incomplete and must be completed
     * before this task should be completed.
     */
    requisiteTasks: OnboardingTask[];
  };
