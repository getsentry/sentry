import {forwardRef} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import moment from 'moment-timezone';

import {navigateTo} from 'sentry/actionCreators/navigation';
import Avatar from 'sentry/components/avatar';
import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import LetterAvatar from 'sentry/components/letterAvatar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconClose, IconLock, IconSync} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import {space} from 'sentry/styles/space';
import type {OnboardingTask, OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import testableTransition from 'sentry/utils/testableTransition';
import useRouter from 'sentry/utils/useRouter';
import withOrganization from 'sentry/utils/withOrganization';

import SkipConfirm from './skipConfirm';
import {taskIsDone} from './utils';

const recordAnalytics = (
  task: OnboardingTask,
  organization: Organization,
  action: string
) =>
  trackAnalytics('quick_start.task_card_clicked', {
    organization,
    todo_id: task.task,
    todo_title: task.title,
    action,
    new_experience: false,
  });

type Props = {
  forwardedRef: React.Ref<HTMLDivElement>;
  hidePanel: () => void;
  /**
   * Fired when a task is completed. This will typically happen if there is a
   * supplemental component with the ability to complete a task
   */
  onMarkComplete: (taskKey: OnboardingTaskKey) => void;

  /**
   * Fired when the task has been skipped
   */
  onSkip: (taskKey: OnboardingTaskKey) => void;

  organization: Organization;
  /**
   * Task to render
   */
  task: OnboardingTask;
};

function Task(props: Props) {
  const {task, onSkip, onMarkComplete, forwardedRef, organization, hidePanel} = props;
  const router = useRouter();
  const handleSkip = () => {
    recordAnalytics(task, organization, 'skipped');
    onSkip(task.task);
  };

  const handleClick = (e: React.MouseEvent) => {
    recordAnalytics(task, organization, 'clickthrough');
    e.stopPropagation();

    if (isDemoModeEnabled()) {
      DemoWalkthroughStore.activateGuideAnchor(task.task);
    }

    if (task.actionType === 'external') {
      window.open(task.location, '_blank');
    }

    if (task.actionType === 'action') {
      task.action(router);
    }

    if (task.actionType === 'app') {
      // Convert all paths to a location object
      let to =
        typeof task.location === 'string' ? {pathname: task.location} : task.location;
      // Add referrer to all links
      to = {...to, query: {...to.query, referrer: 'onboarding_task'}};

      navigateTo(to, router);
    }
    hidePanel();
  };

  if (taskIsDone(task) && task.completionSeen) {
    const completedOn = moment(task.dateCompleted);

    return (
      <TaskCard ref={forwardedRef} onClick={handleClick}>
        <CompleteTitle>
          <StatusIndicator>
            {task.status === 'complete' && <CompleteIndicator />}
            {task.status === 'skipped' && <SkippedIndicator />}
          </StatusIndicator>
          {task.title}
          <DateCompleted title={completedOn.toString()}>
            {completedOn.fromNow()}
          </DateCompleted>
          {task.user ? (
            <TaskUserAvatar hasTooltip user={task.user} />
          ) : (
            <Tooltip
              containerDisplayMode="inherit"
              title={t('No user was associated with completing this task')}
            >
              <TaskBlankAvatar round />
            </Tooltip>
          )}
        </CompleteTitle>
      </TaskCard>
    );
  }

  const IncompleteMarker = task.requisiteTasks.length > 0 && (
    <Tooltip
      containerDisplayMode="block"
      title={tct('[requisite] before completing this task', {
        requisite: task.requisiteTasks[0]!.title,
      })}
    >
      <IconLock color="pink400" locked />
    </Tooltip>
  );

  const {SupplementComponent} = task;
  const supplement = SupplementComponent && (
    <SupplementComponent task={task} onCompleteTask={() => onMarkComplete(task.task)} />
  );

  const skipAction = task.skippable && (
    <SkipConfirm onSkip={handleSkip}>
      {({skip}) => (
        <CloseButton
          borderless
          size="zero"
          aria-label={t('Close')}
          icon={<IconClose size="xs" />}
          onClick={skip}
        />
      )}
    </SkipConfirm>
  );

  return (
    <TaskCard
      interactive
      ref={forwardedRef}
      onClick={handleClick}
      data-test-id={task.task}
    >
      <IncompleteTitle>
        {IncompleteMarker}
        {task.title}
      </IncompleteTitle>
      <Description>{`${task.description}`}</Description>
      {task.requisiteTasks.length === 0 && (
        <ActionBar>
          {skipAction}
          {supplement}
          {task.status === 'pending' ? (
            <InProgressIndicator user={task.user} />
          ) : (
            <Button priority="primary" size="sm">
              {t('Start')}
            </Button>
          )}
        </ActionBar>
      )}
    </TaskCard>
  );
}

const TaskCard = styled(Card)`
  position: relative;
  padding: ${space(2)} ${space(3)};
`;

const IncompleteTitle = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
  font-weight: ${p => p.theme.fontWeightBold};
`;

const CompleteTitle = styled(IncompleteTitle)`
  grid-template-columns: min-content 1fr max-content min-content;
`;

const Description = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin: ${space(0.5)} 0 0 0;
`;

const ActionBar = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  margin-top: ${space(1.5)};
`;

type InProgressIndicatorProps = React.HTMLAttributes<HTMLDivElement> & {
  user?: AvatarUser | null;
};

const InProgressIndicator = styled(({user, ...props}: InProgressIndicatorProps) => (
  <div {...props}>
    <Tooltip
      disabled={!user}
      containerDisplayMode="flex"
      title={tct('This task has been started by [user]', {
        user: user?.name,
      })}
    >
      <IconSync />
    </Tooltip>
    {t('Task in progress...')}
  </div>
))`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.pink400};
  display: grid;
  grid-template-columns: max-content max-content;
  align-items: center;
  gap: ${space(1)};
`;

const CloseButton = styled(Button)`
  position: absolute;
  right: ${space(1.5)};
  top: ${space(1.5)};
  color: ${p => p.theme.gray300};
`;

const transition = testableTransition();

const StatusIndicator = styled(motion.div)`
  display: flex;
`;
StatusIndicator.defaultProps = {
  variants: {
    initial: {opacity: 0, x: 10},
    animate: {opacity: 1, x: 0},
  },
  transition,
};

const CompleteIndicator = styled(IconCheckmark)``;
CompleteIndicator.defaultProps = {
  isCircled: true,
  color: 'green300',
};

const SkippedIndicator = styled(IconClose)``;
SkippedIndicator.defaultProps = {
  isCircled: true,
  color: 'pink400',
};

const completedItemAnimation = {
  initial: {opacity: 0, x: -10},
  animate: {opacity: 1, x: 0},
};

const DateCompleted = styled(motion.div)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

DateCompleted.defaultProps = {
  variants: completedItemAnimation,
  transition,
};

const TaskUserAvatar = motion(Avatar);
TaskUserAvatar.defaultProps = {
  variants: completedItemAnimation,
  transition,
};

const TaskBlankAvatar = styled(motion(LetterAvatar))`
  position: unset;
`;

TaskBlankAvatar.defaultProps = {
  variants: completedItemAnimation,
  transition,
};

const WrappedTask = withOrganization(Task);

export default forwardRef<
  HTMLDivElement,
  Omit<React.ComponentProps<typeof WrappedTask>, 'forwardedRef'>
>((props, ref) => <WrappedTask forwardedRef={ref} {...props} />);
