import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import partition from 'lodash/partition';

import HighlightTopRight from 'sentry-images/pattern/highlight-top-right.svg';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import SkipConfirm from 'sentry/components/onboardingWizard/skipConfirm';
import type {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import {taskIsDone} from 'sentry/components/onboardingWizard/utils';
import ProgressRing from 'sentry/components/progressRing';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconClose, IconNot, IconSync} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import {space} from 'sentry/styles/space';
import {type OnboardingTask, OnboardingTaskKey} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import useApi from 'sentry/utils/useApi';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

const orderedGettingStartedTasks = [
  OnboardingTaskKey.FIRST_PROJECT,
  OnboardingTaskKey.FIRST_EVENT,
  OnboardingTaskKey.INVITE_MEMBER,
  OnboardingTaskKey.ALERT_RULE,
  OnboardingTaskKey.SOURCEMAPS,
  OnboardingTaskKey.RELEASE_TRACKING,
  OnboardingTaskKey.LINK_SENTRY_TO_SOURCE_CODE,
];

const orderedBeyondBasicsTasks = [
  OnboardingTaskKey.REAL_TIME_NOTIFICATIONS,
  OnboardingTaskKey.SESSION_REPLAY,
  OnboardingTaskKey.FIRST_TRANSACTION,
  OnboardingTaskKey.SECOND_PLATFORM,
];

function groupTasksByCompletion(tasks: OnboardingTask[]) {
  const [completedTasks, incompletedTasks] = partition(tasks, task => taskIsDone(task));
  return {
    completedTasks,
    incompletedTasks,
  };
}

interface TaskCardProps {
  description: React.ReactNode;
  status: 'complete' | 'inProgress' | 'skipped' | 'pending';
  title: string;
  action?: React.ReactNode;
  iconTooltipText?: string;
  onClick?: (e: React.MouseEvent) => void;
  progress?: number;
}

function TaskCard({
  description,
  iconTooltipText,
  status,
  progress,
  title,
  action,
  onClick,
}: TaskCardProps) {
  const theme = useTheme();

  const progressValue = progress ?? 0;

  return (
    <TaskCardWrapper
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      hasProgress={progressValue > 0}
    >
      {onClick && <InteractionStateLayer />}
      <TaskCardIcon>
        <Tooltip
          title={iconTooltipText}
          disabled={!iconTooltipText}
          containerDisplayMode="flex"
        >
          {status === 'complete' ? (
            <IconCheckmark
              css={css`
                color: ${theme.success};
                height: ${theme.fontSizeLarge};
                width: ${theme.fontSizeLarge};
              `}
              isCircled
            />
          ) : status === 'skipped' ? (
            <IconNot
              css={css`
                color: ${theme.disabled};
                height: ${theme.fontSizeLarge};
                width: ${theme.fontSizeLarge};
              `}
            />
          ) : status === 'pending' ? (
            <IconSync // TODO(Telemetry): Remove pending status
              css={css`
                color: ${theme.pink400};
                height: ${theme.fontSizeLarge};
                width: ${theme.fontSizeLarge};
              `}
            />
          ) : (
            <ProgressRing
              value={progressValue * 100}
              progressEndcaps="round"
              size={16}
              barWidth={2}
            />
          )}
        </Tooltip>
      </TaskCardIcon>
      <TaskCardDescription>
        <strong>{title}</strong>
        <p>{description}</p>
      </TaskCardDescription>
      <div>{action}</div>
    </TaskCardWrapper>
  );
}

interface TaskProps {
  hidePanel: () => void;
  task: OnboardingTask;
  completed?: boolean;
  showWaitingIndicator?: boolean;
}

function Task({task, hidePanel, showWaitingIndicator}: TaskProps) {
  const api = useApi();
  const organization = useOrganization();
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      trackAnalytics('quick_start.task_card_clicked', {
        organization,
        todo_id: task.task,
        todo_title: task.title,
        action: 'clickthrough',
        new_experience: true,
      });

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
    },
    [task, organization, router, hidePanel]
  );

  const handleMarkSkipped = useCallback(
    (taskKey: OnboardingTaskKey) => {
      trackAnalytics('quick_start.task_card_clicked', {
        organization,
        todo_id: task.task,
        todo_title: task.title,
        action: 'skipped',
        new_experience: true,
      });
      updateOnboardingTask(api, organization, {
        task: taskKey,
        status: 'skipped',
        completionSeen: true,
      });
    },
    [task, organization, api]
  );

  const iconTooltipText = useMemo(() => {
    switch (task.status) {
      case 'complete':
        return t('Task completed');
      case 'pending':
        return task.pendingTitle ?? t('Task in progress\u2026');
      case 'skipped':
        return t('Task skipped');
      default:
        return undefined;
    }
  }, [task.status, task.pendingTitle]);

  return (
    <TaskWrapper>
      <TaskCard
        onClick={
          task.status === 'complete' || task.status === 'skipped'
            ? undefined
            : handleClick
        }
        description={task.description}
        iconTooltipText={iconTooltipText}
        status={task.status}
        title={task.title}
        action={
          task.status === 'complete' || task.status === 'skipped'
            ? undefined
            : task.requisiteTasks.length === 0 && (
                <TaskActions>
                  {task.skippable && (
                    <SkipConfirm onSkip={() => handleMarkSkipped(task.task)}>
                      {({skip}) => (
                        <Button
                          borderless
                          size="zero"
                          aria-label={t('Close')}
                          title={t('Skip Task')}
                          icon={<IconClose color="gray300" isCircled />}
                          onClick={skip}
                          css={css`
                            /* If the pulsing indicator is active, the close button
                       * should be above it so it's clickable.
                       */
                            z-index: 1;
                          `}
                        />
                      )}
                    </SkipConfirm>
                  )}
                  {task.SupplementComponent && showWaitingIndicator && (
                    <task.SupplementComponent task={task} />
                  )}
                </TaskActions>
              )
        }
      />
    </TaskWrapper>
  );
}

interface TaskGroupProps {
  /**
   * Used for analytics
   */
  group: 'getting_started' | 'beyond_basics';
  hidePanel: () => void;
  taskKeyForWaitingIndicator: OnboardingTaskKey | undefined;
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
  taskKeyForWaitingIndicator,
  toggleable = true,
  group,
}: TaskGroupProps) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(expanded);
  const {completedTasks, incompletedTasks} = groupTasksByCompletion(tasks);
  const [taskGroupComplete, setTaskGroupComplete] = useLocalStorageState(
    `quick-start:${organization.slug}:${group}-completed`,
    false
  );

  useEffect(() => {
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
      <TaskCard
        title={title}
        description={tct('[totalCompletedTasks] out of [totalTasks] tasks completed', {
          totalCompletedTasks: completedTasks.length,
          totalTasks: tasks.length,
        })}
        status={completedTasks.length === tasks.length ? 'complete' : 'inProgress'}
        progress={completedTasks.length / tasks.length}
        onClick={toggleable ? () => setIsExpanded(!isExpanded) : undefined}
        action={
          <Button
            icon={<Chevron direction={isExpanded ? 'up' : 'down'} />}
            aria-label={isExpanded ? t('Collapse') : t('Expand')}
            aria-expanded={isExpanded}
            size="zero"
            borderless
          />
        }
      />
      {isExpanded && (
        <Fragment>
          <hr />
          <TaskGroupBody>
            {incompletedTasks.map(task => (
              <Task
                key={task.task}
                task={task}
                hidePanel={hidePanel}
                showWaitingIndicator={taskKeyForWaitingIndicator === task.task}
              />
            ))}
            {completedTasks.map(task => (
              <Task key={task.task} task={task} hidePanel={hidePanel} />
            ))}
          </TaskGroupBody>
        </Fragment>
      )}
    </TaskGroupWrapper>
  );
}

interface NewSidebarProps
  extends Pick<CommonSidebarProps, 'orientation' | 'collapsed'>,
    Pick<
      ReturnType<typeof useOnboardingTasks>,
      'gettingStartedTasks' | 'beyondBasicsTasks'
    > {
  onClose: () => void;
}

export function NewOnboardingSidebar({
  onClose,
  orientation,
  collapsed,
  gettingStartedTasks,
  beyondBasicsTasks,
}: NewSidebarProps) {
  const walkthrough = isDemoModeEnabled();

  const sortedGettingStartedTasks = gettingStartedTasks.sort(
    (a, b) =>
      orderedGettingStartedTasks.indexOf(a.task) -
      orderedGettingStartedTasks.indexOf(b.task)
  );

  const sortedBeyondBasicsTasks = beyondBasicsTasks.sort(
    (a, b) =>
      orderedBeyondBasicsTasks.indexOf(a.task) - orderedBeyondBasicsTasks.indexOf(b.task)
  );

  const taskKeyForWaitingIndicator = useMemo(() => {
    return [...sortedGettingStartedTasks, ...sortedBeyondBasicsTasks].find(
      task => !taskIsDone(task) && !!task.SupplementComponent
    )?.task;
  }, [sortedGettingStartedTasks, sortedBeyondBasicsTasks]);

  return (
    <Wrapper
      collapsed={collapsed}
      hidePanel={onClose}
      orientation={orientation}
      title={walkthrough ? t('Guided Tour') : t('Quick Setup')}
    >
      <Content>
        <TaskGroup
          title={t('Getting Started')}
          tasks={sortedGettingStartedTasks}
          hidePanel={onClose}
          expanded={
            groupTasksByCompletion(sortedGettingStartedTasks).incompletedTasks.length > 0
          }
          toggleable={sortedBeyondBasicsTasks.length > 0}
          taskKeyForWaitingIndicator={taskKeyForWaitingIndicator}
          group="getting_started"
        />
        {sortedBeyondBasicsTasks.length > 0 && (
          <TaskGroup
            title={t('Beyond the Basics')}
            tasks={sortedBeyondBasicsTasks}
            hidePanel={onClose}
            expanded={
              groupTasksByCompletion(sortedGettingStartedTasks).incompletedTasks
                .length === 0 &&
              groupTasksByCompletion(sortedBeyondBasicsTasks).incompletedTasks.length > 0
            }
            taskKeyForWaitingIndicator={taskKeyForWaitingIndicator}
            group="beyond_basics"
          />
        )}
      </Content>
      <BottomLeft src={HighlightTopRight} />
    </Wrapper>
  );
}

const Wrapper = styled(SidebarPanel)`
  width: 100%;
  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    width: 450px;
  }
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
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};

  hr {
    border-color: ${p => p.theme.translucentBorder};
    margin: ${space(1)} -${space(1)};
  }
`;

const TaskGroupBody = styled(motion.ul)`
  border-radius: ${p => p.theme.borderRadius};
  list-style-type: none;
  padding: 0;
  margin: 0;
`;

const TaskWrapper = styled(motion.li)`
  gap: ${space(1)};
`;

TaskWrapper.defaultProps = {
  layout: true,
};

const TaskActions = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(1)};
`;

const BottomLeft = styled('img')`
  width: 60%;
  transform: rotate(180deg);
  margin-top: ${space(3)};
`;

const TaskCardWrapper = styled('div')<{hasProgress: boolean}>`
  position: relative;
  display: grid;
  grid-template-columns: max-content 1fr 20px;
  gap: ${space(1.5)};
  cursor: ${p => (p.onClick ? 'pointer' : 'default')};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(1.5)};
  p {
    margin: 0;
    font-size: ${p => p.theme.fontSizeSmall};
    color: ${p => (p.hasProgress ? p.theme.successText : p.theme.subText)};
  }
`;

const TaskCardDescription = styled('div')`
  line-height: 20px;
`;

const TaskCardIcon = styled('div')`
  display: flex;
  align-items: center;
  height: 20px;
`;
