import {RouteContextInterface} from 'react-router';

import type {Organization, Project} from 'sentry/types';
import {OnboardingState} from 'sentry/views/onboarding/targetedOnboarding/types';

import type {AvatarUser} from './user';

export type OnboardingSupplementComponentProps = {
  onCompleteTask: () => void;
  task: OnboardingTask;
};

export type OnboardingCustomComponentProps = {
  onboardingState: OnboardingState | null;
  organization: Organization;
  projects: Project[];
  setOnboardingState: (state: OnboardingState | null) => void;
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
  action: (props: RouteContextInterface) => void;
  actionType: 'action';
}

interface OnboardingTypeDescriptorWithExternal extends OnboardingTaskDescriptorBase {
  actionType: 'app' | 'external';
  location: string;
}

export type OnboardingTaskDescriptor =
  | OnboardingTypeDescriptorWithAction
  | OnboardingTypeDescriptorWithExternal;

export interface OnboardingTaskStatus {
  status: 'skipped' | 'pending' | 'complete';
  task: OnboardingTaskKey;
  completionSeen?: string;
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

export type OnboardingTask = OnboardingTaskWithAction | OnboardingTaskWithExternal;
