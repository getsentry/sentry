import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
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
import {
  type OnboardingTask,
  OnboardingTaskKey,
  type OnboardingTaskStatus,
} from 'sentry/types/onboarding';
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

interface TaskProps extends Pick<OnboardingTaskStatus, 'status'> {
  hidePanel: () => void;
  task: OnboardingTask;
  completed?: boolean;
  showWaitingIndicator?: boolean;
}

function Task({task, status, hidePanel, showWaitingIndicator}: TaskProps) {
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

  if (status === 'complete') {
    return (
      <TaskWrapper css={taskCompletedCss}>
        <strong>{task.title}</strong>
        <Tooltip title={t('Task completed')} containerDisplayMode="flex">
          <IconCheckmark color="green300" isCircled />
        </Tooltip>
      </TaskWrapper>
    );
  }

  if (status === 'skipped') {
    return (
      <TaskWrapper css={taskCompletedCss}>
        <strong>{task.title}</strong>
        <Tooltip title={t('Task skipped')} containerDisplayMode="flex">
          <IconNot color="gray300" />
        </Tooltip>
      </TaskWrapper>
    );
  }

  return (
    <TaskWrapper onClick={handleClick} css={taskIncompleteCss}>
      <InteractionStateLayer />
      <div>
        <strong>{task.title}</strong>
        <p>{task.description}</p>
      </div>
      {task.requisiteTasks.length === 0 && (
        <TaskActions>
          {task.skippable && (
            <SkipConfirm onSkip={() => handleMarkSkipped(task.task)}>
              {({skip}) => (
                <Button
                  borderless
                  size="zero"
                  aria-label={t('Close')}
                  icon={<IconClose size="xs" color="gray300" />}
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
          {status === 'pending' && (
            <Tooltip
              title={task.pendingTitle ?? t('Task in progress\u2026')}
              containerDisplayMode="flex"
              css={css`
                justify-content: center;
                cursor: default;
              `}
            >
              <IconSync color="pink400" />
            </Tooltip>
          )}
        </TaskActions>
      )}
    </TaskWrapper>
  );
}

interface TaskGroupProps {
  description: string;
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
  description,
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
      <TaskGroupHeader
        role="button"
        onClick={toggleable ? () => setIsExpanded(!isExpanded) : undefined}
      >
        {toggleable && <InteractionStateLayer />}
        <div>
          <TaskGroupTitle>
            <strong>{title}</strong>
            {incompletedTasks.length === 0 && (
              <Tooltip title={t('All tasks completed')} containerDisplayMode="flex">
                <IconCheckmark color="green300" isCircled />
              </Tooltip>
            )}
          </TaskGroupTitle>
          <p>{description}</p>
        </div>
        {toggleable && (
          <Chevron
            direction={isExpanded ? 'up' : 'down'}
            role="presentation"
            size="large"
          />
        )}
      </TaskGroupHeader>
      {isExpanded && (
        <Fragment>
          <hr />
          <TaskGroupBody>
            <TaskGroupProgress>
              {tct('[totalCompletedTasks] out of [totalTasks] tasks completed', {
                totalCompletedTasks: completedTasks.length,
                totalTasks: tasks.length,
              })}
              <ProgressRing
                value={(completedTasks.length / tasks.length) * 100}
                progressEndcaps="round"
                size={16}
                barWidth={2}
              />
            </TaskGroupProgress>
            {incompletedTasks.map(task => (
              <Task
                key={task.task}
                task={task}
                hidePanel={hidePanel}
                showWaitingIndicator={taskKeyForWaitingIndicator === task.task}
                status={task.status}
              />
            ))}
            {completedTasks.length > 0 && (
              <Fragment>
                <TaskGroupProgress completed>{t('Completed')}</TaskGroupProgress>
                {completedTasks.map(task => (
                  <Task
                    key={task.task}
                    task={task}
                    hidePanel={hidePanel}
                    status={task.status}
                  />
                ))}
              </Fragment>
            )}
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

export function DeprecatedNewOnboardingSidebar({
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
          description={t(
            'Complete these essential setups to capture your first errors, add commit and release information and get alerted when something’s wrong.'
          )}
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
            description={t(
              'Ready to level-up? Get even more value out of Sentry by enabling advanced features and fine-tuning your workflow.'
            )}
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

const TaskGroupHeader = styled('div')<{toggleable?: boolean}>`
  cursor: ${p => (p.onClick ? 'pointer' : 'default')};
  display: grid;
  grid-template-columns: 1fr max-content;
  padding: ${space(1)} ${space(1.5)};
  gap: ${space(1.5)};
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  align-items: center;

  p {
    margin: 0;
    font-size: ${p => p.theme.fontSizeSmall};
    color: ${p => p.theme.subText};
  }
`;

const TaskGroupTitle = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  gap: ${space(1)};
`;

const TaskGroupBody = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
`;

const TaskGroupProgress = styled('div')<{completed?: boolean}>`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: ${space(0.75)} ${space(1.5)};
  ${p =>
    p.completed
      ? css`
          color: ${p.theme.green300};
        `
      : css`
          color: ${p.theme.subText};
          display: grid;
          grid-template-columns: 1fr max-content;
          align-items: center;
          gap: ${space(1)};
        `}
`;

const taskIncompleteCss = css`
  position: relative;
  cursor: pointer;
  align-items: flex-start;
`;

const taskCompletedCss = css`
  strong {
    opacity: 0.5;
  }
  align-items: center;
`;

const TaskWrapper = styled(motion.li)`
  padding: ${space(1)} ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};

  p {
    margin: 0;
    font-size: ${p => p.theme.fontSizeSmall};
    color: ${p => p.theme.subText};
  }
`;

TaskWrapper.defaultProps = {
  layout: true,
};

const TaskActions = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const BottomLeft = styled('img')`
  width: 60%;
  transform: rotate(180deg);
  margin-top: ${space(3)};
`;
