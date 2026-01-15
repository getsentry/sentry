import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useMutateOnboardingTasks} from 'sentry/components/onboarding/useMutateOnboardingTasks';
import {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import {findCompleteTasks, taskIsDone} from 'sentry/components/onboardingWizard/utils';
import ProgressRing from 'sentry/components/progressRing';
import {IconCheckmark, IconChevron, IconNot} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import {space} from 'sentry/styles/space';
import {OnboardingTaskKey, type OnboardingTask} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {DemoTour, useDemoTours} from 'sentry/utils/demoMode/demoTours';
import {updateDemoWalkthroughTask} from 'sentry/utils/demoMode/guides';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useStackedNavigationTour} from 'sentry/views/nav/tour/tour';

/**
 * How long (in ms) to delay before beginning to mark tasks complete
 */
const INITIAL_MARK_COMPLETE_TIMEOUT = 100;

const orderedGettingStartedTasks = [
  OnboardingTaskKey.FIRST_PROJECT,
  OnboardingTaskKey.FIRST_EVENT,
  OnboardingTaskKey.INVITE_MEMBER,
  OnboardingTaskKey.ALERT_RULE,
  OnboardingTaskKey.SOURCEMAPS,
  OnboardingTaskKey.LINK_SENTRY_TO_SOURCE_CODE,
  OnboardingTaskKey.RELEASE_TRACKING,
];

const orderedBeyondBasicsTasks = [
  OnboardingTaskKey.REAL_TIME_NOTIFICATIONS,
  OnboardingTaskKey.SESSION_REPLAY,
  OnboardingTaskKey.FIRST_TRANSACTION,
  OnboardingTaskKey.SECOND_PLATFORM,
];

function groupTasksByCompletion(tasks: OnboardingTask[]) {
  const [completedTasks, incompletedTasks] = partition(tasks, task =>
    findCompleteTasks(task)
  );
  return {
    completedTasks,
    incompletedTasks,
  };
}

interface TaskCardProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

function TaskCard({
  description,
  icon,
  title,
  actions,
  onClick,
  className,
}: TaskCardProps) {
  return (
    <TaskCardWrapper
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={className}
    >
      {onClick && <InteractionStateLayer />}
      <Flex justify="center" align="center" height="20px">
        {icon}
      </Flex>
      <TaskCardDescription>
        {title}
        {description && <p>{description}</p>}
      </TaskCardDescription>
      <TaskCardActions>{actions}</TaskCardActions>
    </TaskCardWrapper>
  );
}

interface TaskStatusIconProps {
  progress?: number;
  status?: 'complete' | 'skipped';
  tooltipText?: string;
}

function TaskStatusIcon({status, tooltipText}: TaskStatusIconProps) {
  const theme = useTheme();
  return (
    <Tooltip title={tooltipText} disabled={!tooltipText} containerDisplayMode="flex">
      {status === 'complete' ? (
        <IconCheckmark
          data-test-id="task-status-icon-complete"
          css={css`
            color: ${theme.tokens.content.accent};
          `}
          size="sm"
        />
      ) : (
        <IconNot
          data-test-id="task-status-icon-skipped"
          css={css`
            color: ${theme.tokens.content.accent};
          `}
          size="sm"
        />
      )}
    </Tooltip>
  );
}

interface SkipConfirmationProps {
  onConfirm: () => void;
  onDismiss: () => void;
}

function SkipConfirmation({onConfirm, onDismiss}: SkipConfirmationProps) {
  return (
    <Alert variant="info">
      <Flex direction="column" gap="md">
        {t("Not sure what to do? We're here for you!")}
        <Flex justify="between" gap="xs" flex={1}>
          <LinkButton external href="https://sentry.io/support/" size="xs">
            {t('Contact Support')}
          </LinkButton>
          <ButtonBar gap="xs">
            <Button
              onClick={event => {
                event.stopPropagation();
                onDismiss();
              }}
              size="xs"
            >
              {t('Cancel')}
            </Button>
            <Button
              priority="primary"
              onClick={event => {
                event.stopPropagation();
                onConfirm();
              }}
              size="xs"
            >
              {t('Just Skip')}
            </Button>
          </ButtonBar>
        </Flex>
      </Flex>
    </Alert>
  );
}

interface TaskProps {
  hidePanel: () => void;
  task: OnboardingTask;
  completed?: boolean;
}

function Task({task, hidePanel}: TaskProps) {
  const organization = useOrganization();
  const mutateOnboardingTasks = useMutateOnboardingTasks();
  const router = useRouter();
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);

  const tours = useDemoTours();
  const sidebarTour = useStackedNavigationTour();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      trackAnalytics('quick_start.task_card_clicked', {
        organization,
        todo_id: task.task,
        todo_title: task.title,
        action: 'clickthrough',
      });

      e.stopPropagation();

      if (isDemoModeActive()) {
        if (task.task === OnboardingTaskKey.PERFORMANCE_GUIDE) {
          tours?.[DemoTour.PERFORMANCE]?.startTour();
        } else if (task.task === OnboardingTaskKey.SIDEBAR_GUIDE) {
          // Demo mode uses existing sidebar tour
          sidebarTour.startTour();
        } else if (task.task === OnboardingTaskKey.RELEASE_GUIDE) {
          tours?.[DemoTour.RELEASES]?.startTour();
        } else if (task.task === OnboardingTaskKey.ISSUE_GUIDE) {
          tours?.[DemoTour.ISSUES]?.startTour();
        } else {
          DemoWalkthroughStore.activateGuideAnchor(task.task);
        }
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
    },
    [task, organization, router, hidePanel, tours, sidebarTour]
  );

  const handleMarkSkipped = useCallback(() => {
    // all demos tasks are not skippable,
    // so this apply for the quick start only.
    // Adding this check here just in case it changes in the future
    if (isDemoModeActive()) {
      return;
    }

    trackAnalytics('quick_start.task_card_clicked', {
      organization,
      todo_id: task.task,
      todo_title: task.title,
      action: 'skipped',
    });

    mutateOnboardingTasks.mutate([
      {
        task: task.task,
        status: 'skipped',
        completionSeen: true,
      },
    ]);
  }, [task, organization, mutateOnboardingTasks]);

  const iconTooltipText = useMemo(() => {
    switch (task.status) {
      case 'complete':
        return t('Task completed');
      case 'skipped':
        return t('Task skipped');
      default:
        return undefined;
    }
  }, [task.status]);

  if (task.status === 'complete' || task.status === 'skipped') {
    return (
      <TaskWrapper
        css={css`
          opacity: 50%;
        `}
      >
        <TaskCard
          icon={<TaskStatusIcon status={task.status} tooltipText={iconTooltipText} />}
          description={task.description}
          title={<strong>{<s>{task.title}</s>}</strong>}
        />
      </TaskWrapper>
    );
  }

  return (
    <TaskWrapper>
      <TaskCard
        onClick={handleClick}
        icon={
          task.skippable ? (
            <Button
              icon={<IconNot size="sm" variant="muted" />}
              aria-label={t('Skip Task')}
              onClick={event => {
                event.stopPropagation();
                setShowSkipConfirmation(!showSkipConfirmation);
              }}
              size="zero"
              borderless
              title={t('Skip Task')}
            />
          ) : undefined
        }
        description={task.description}
        title={<strong>{task.title}</strong>}
        actions={
          <Flex justify="center" align="center" width="20px" height="100%">
            <IconChevron direction="right" size="xs" variant="muted" />
          </Flex>
        }
      />
      {showSkipConfirmation && (
        <SkipConfirmation
          onConfirm={() => {
            handleMarkSkipped();
            setShowSkipConfirmation(false);
          }}
          onDismiss={() => setShowSkipConfirmation(false)}
        />
      )}
    </TaskWrapper>
  );
}

interface ExpandedTaskGroupProps {
  hidePanel: () => void;
  tasks: OnboardingTask[];
}

function ExpandedTaskGroup({tasks, hidePanel}: ExpandedTaskGroupProps) {
  const mutateOnboardingTasks = useMutateOnboardingTasks();

  const markCompletionTimeout = useRef<number | undefined>(undefined);

  const unseenDoneTasks = useMemo(
    () => tasks.filter(task => taskIsDone(task) && !task.completionSeen),
    [tasks]
  );

  function completionTimeout(time: number): Promise<void> {
    window.clearTimeout(markCompletionTimeout.current);
    return new Promise(resolve => {
      markCompletionTimeout.current = window.setTimeout(resolve, time);
    });
  }

  const markTasksAsSeen = useCallback(() => {
    const tasksToMarkComplete = tasks
      .filter(task => taskIsDone(task) && !task.completionSeen)
      .map(task => ({...task, completionSeen: true}));

    if (isDemoModeActive()) {
      for (const task of tasksToMarkComplete) {
        updateDemoWalkthroughTask(task);
      }
    } else {
      mutateOnboardingTasks.mutate(tasksToMarkComplete);
    }
  }, [mutateOnboardingTasks, tasks]);

  const markSeenOnOpen = useCallback(async () => {
    // Add a minor delay to marking tasks complete to account for the animation
    // opening of the group
    await completionTimeout(INITIAL_MARK_COMPLETE_TIMEOUT);
    markTasksAsSeen();
  }, [markTasksAsSeen]);

  useEffect(() => {
    if (unseenDoneTasks.length > 0) {
      markSeenOnOpen();
    }

    return () => {
      window.clearTimeout(markCompletionTimeout.current);
    };
  }, [unseenDoneTasks, markSeenOnOpen]);

  return (
    <Fragment>
      <hr />
      <TaskGroupBody>
        {tasks.map(task => (
          <Task key={task.task} task={task} hidePanel={hidePanel} />
        ))}
      </TaskGroupBody>
    </Fragment>
  );
}

interface TaskGroupProps {
  /**
   * Used for analytics
   */
  group: 'getting_started' | 'beyond_basics';
  hidePanel: () => void;
  tasks: OnboardingTask[];
  title: string;
  expanded?: boolean;
  toggleable?: boolean;
}

function TaskGroup({
  title,
  tasks,
  expanded,
  hidePanel,
  toggleable = true,
  group,
}: TaskGroupProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(expanded);
  const {completedTasks} = groupTasksByCompletion(tasks);

  const [taskGroupComplete, setTaskGroupComplete] = useLocalStorageState(
    `quick-start:${organization.slug}:${group}-completed`,
    false
  );

  const doneTasks = useMemo(() => {
    return tasks.filter(task => taskIsDone(task));
  }, [tasks]);

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setIsExpanded(expanded);
  }, [expanded]);

  useEffect(() => {
    if (completedTasks.length !== tasks.length || taskGroupComplete) {
      return;
    }

    trackAnalytics('quick_start.task_group_completed', {
      organization,
      group,
    });

    setTaskGroupComplete(true);
  }, [
    group,
    organization,
    completedTasks,
    tasks,
    setTaskGroupComplete,
    taskGroupComplete,
  ]);

  return (
    <TaskGroupWrapper>
      <TaskGroupHeader
        title={<strong>{title}</strong>}
        description={
          tasks.length > 1
            ? tct('[totalCompletedTasks] out of [totalTasks] tasks completed', {
                totalCompletedTasks: doneTasks.length,
                totalTasks: tasks.length,
              })
            : tct('[totalCompletedTasks] out of [totalTasks] task completed', {
                totalCompletedTasks: doneTasks.length,
                totalTasks: tasks.length,
              })
        }
        hasProgress={doneTasks.length > 0}
        onClick={toggleable ? () => setIsExpanded(!isExpanded) : undefined}
        icon={
          doneTasks.length === tasks.length ? (
            <TaskStatusIcon status="complete" />
          ) : (
            <ProgressRing
              value={(doneTasks.length / tasks.length) * 100}
              backgroundColor={theme.colors.gray200}
              progressEndcaps="round"
              progressColor={theme.tokens.content.accent}
              size={22}
              barWidth={4}
            />
          )
        }
        actions={
          <Button
            icon={<IconChevron direction={isExpanded ? 'up' : 'down'} size="sm" />}
            aria-label={isExpanded ? t('Collapse') : t('Expand')}
            aria-expanded={isExpanded}
            size="zero"
            borderless
          />
        }
      />
      {isExpanded && <ExpandedTaskGroup tasks={tasks} hidePanel={hidePanel} />}
    </TaskGroupWrapper>
  );
}

interface OnboardingSidebarContentProps {
  onClose: () => void;
}

export function OnboardingSidebarContent({onClose}: OnboardingSidebarContentProps) {
  const {gettingStartedTasks, beyondBasicsTasks, allTasks, doneTasks} =
    useOnboardingTasks();

  const sortedGettingStartedTasks = gettingStartedTasks.sort(
    (a, b) =>
      orderedGettingStartedTasks.indexOf(a.task) -
      orderedGettingStartedTasks.indexOf(b.task)
  );

  const sortedBeyondBasicsTasks = beyondBasicsTasks.sort(
    (a, b) =>
      orderedBeyondBasicsTasks.indexOf(a.task) - orderedBeyondBasicsTasks.indexOf(b.task)
  );

  return (
    <Content data-test-id="quick-start-content">
      <TaskGroup
        title={t('Getting Started')}
        tasks={sortedGettingStartedTasks}
        hidePanel={onClose}
        expanded={
          groupTasksByCompletion(sortedGettingStartedTasks).incompletedTasks.length > 0
        }
        toggleable={sortedBeyondBasicsTasks.length > 0}
        group="getting_started"
      />
      {sortedBeyondBasicsTasks.length > 0 && (
        <TaskGroup
          title={t('Beyond the Basics')}
          tasks={sortedBeyondBasicsTasks}
          hidePanel={onClose}
          expanded={
            groupTasksByCompletion(sortedGettingStartedTasks).incompletedTasks.length ===
              0 &&
            groupTasksByCompletion(sortedBeyondBasicsTasks).incompletedTasks.length > 0
          }
          group="beyond_basics"
        />
      )}
      {allTasks.length === doneTasks.length && (
        <CompletionCelebrationText>
          <div>{t('Good job, you’re all done here!')}</div>
          {t('Now get out of here and write some broken code.')}
        </CompletionCelebrationText>
      )}
    </Content>
  );
}

const CompletionCelebrationText = styled('div')`
  margin-top: ${space(1.5)};
  text-align: center;
`;

const Content = styled('div')`
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  flex: 1;

  p {
    margin-bottom: ${space(1)};
  }
`;

const TaskGroupWrapper = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1)};

  background-color: ${p => p.theme.tokens.background.primary};

  hr {
    border-color: ${p => p.theme.tokens.border.transparent.neutral.muted};
    margin: ${space(1)} -${space(1)};
  }
`;

const TaskGroupHeader = styled(TaskCard)<{hasProgress: boolean}>`
  p {
    color: ${p =>
      p.hasProgress ? p.theme.tokens.content.accent : p.theme.tokens.content.secondary};
  }
`;

const TaskGroupBody = styled('ul')`
  border-radius: ${p => p.theme.radius.md};
  list-style-type: none;
  padding: 0;
  margin: 0;
`;

const TaskWrapper = styled('li')`
  gap: ${space(1)};
  p {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const TaskCardWrapper = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: 22px 1fr max-content;
  gap: ${space(1.5)};
  cursor: ${p => (p.onClick ? 'pointer' : 'default')};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1)} ${space(1.5)};
  p {
    margin: 0;
    font-size: ${p => p.theme.fontSize.sm};
  }
  button {
    visibility: hidden;
  }
  :hover {
    button {
      visibility: visible;
    }
  }
`;

const TaskCardDescription = styled('div')`
  line-height: 20px;
  strong {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const TaskCardActions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 20px;
  gap: ${space(1)};
  align-items: flex-start;
`;
