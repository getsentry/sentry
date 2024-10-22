import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import type {OnboardingContextProps} from 'sentry/components/onboarding/onboardingContext';
import SkipConfirm from 'sentry/components/onboardingWizard/skipConfirm';
import {findCompleteTasks, taskIsDone} from 'sentry/components/onboardingWizard/utils';
import ProgressRing from 'sentry/components/progressRing';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import {space} from 'sentry/styles/space';
import {
  type OnboardingTask,
  OnboardingTaskGroup,
  type OnboardingTaskKey,
} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import {getMergedTasks} from './taskConfig';

/**
 * How long (in ms) to delay before beginning to mark tasks complete
 */
const INITIAL_MARK_COMPLETE_TIMEOUT = 600;

/**
 * How long (in ms) to delay between marking each unseen task as complete.
 */
const COMPLETION_SEEN_TIMEOUT = 800;

export function useOnboardingTasks(
  organization: Organization,
  projects: Project[],
  onboardingContext: OnboardingContextProps
) {
  return useMemo(() => {
    const all = getMergedTasks({
      organization,
      projects,
      onboardingContext,
    }).filter(task => task.display);
    return {
      allTasks: all,
      gettingStartedTasks: all.filter(
        task => task.group === OnboardingTaskGroup.GETTING_STARTED
      ),
      beyondBasicsTasks: all.filter(
        task => task.group !== OnboardingTaskGroup.GETTING_STARTED
      ),
      completeTasks: all.filter(findCompleteTasks),
    };
  }, [organization, projects, onboardingContext]);
}

function groupTasksByCompletion(tasks: OnboardingTask[]) {
  const [completedTasks, incompletedTasks] = partition(tasks, task =>
    findCompleteTasks(task)
  );
  return {
    completedTasks,
    incompletedTasks,
  };
}

function getPanelDescription(walkthrough: boolean) {
  if (walkthrough) {
    return {
      title: t('Guided Tours'),
      description: t('Take a guided tour to see what Sentry can do for you'),
    };
  }
  return {
    title: t('Quick Start'),
    description: t('Walk through this guide to get the most out of Sentry right away.'),
  };
}

interface TaskProps {
  hidePanel: () => void;
  task: OnboardingTask;
  completed?: boolean;
}

function Task({task, completed, hidePanel}: TaskProps) {
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
      });

      e.stopPropagation();

      if (isDemoWalkthrough()) {
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

  const handleMarkComplete = useCallback(
    (taskKey: OnboardingTaskKey) => {
      updateOnboardingTask(api, organization, {
        task: taskKey,
        status: 'complete',
        completionSeen: true,
      });
    },
    [api, organization]
  );

  const handleMarkSkipped = useCallback(
    (taskKey: OnboardingTaskKey) => {
      trackAnalytics('quick_start.task_card_clicked', {
        organization,
        todo_id: task.task,
        todo_title: task.title,
        action: 'skipped',
      });
      updateOnboardingTask(api, organization, {
        task: taskKey,
        status: 'skipped',
        completionSeen: true,
      });
    },
    [task, organization, api]
  );

  if (completed) {
    return (
      <TaskWrapper completed>
        <strong>{task.title}</strong>
        <IconCheckmark color="green300" isCircled />
      </TaskWrapper>
    );
  }

  return (
    <TaskWrapper onClick={handleClick}>
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
          {task.SupplementComponent && (
            <task.SupplementComponent
              task={task}
              onCompleteTask={() => handleMarkComplete(task.task)}
            />
          )}
        </TaskActions>
      )}
    </TaskWrapper>
  );
}

interface TaskGroupProps {
  description: string;
  hidePanel: () => void;
  tasks: OnboardingTask[];
  title: string;
  expanded?: boolean;
}

function TaskGroup({title, description, tasks, expanded, hidePanel}: TaskGroupProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const {completedTasks, incompletedTasks} = groupTasksByCompletion(tasks);

  useEffect(() => {
    setIsExpanded(expanded);
  }, [expanded]);

  return (
    <TaskGroupWrapper>
      <TaskGroupHeader role="button" onClick={() => setIsExpanded(!isExpanded)}>
        <InteractionStateLayer />
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <Chevron
          direction={isExpanded ? 'up' : 'down'}
          role="presentation"
          size="large"
        />
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
              <Task key={task.task} task={task} hidePanel={hidePanel} />
            ))}
            {completedTasks.length > 0 && (
              <Fragment>
                <TaskGroupProgress completed>{t('Completed')}</TaskGroupProgress>
                {completedTasks.map(task => (
                  <Task key={task.task} task={task} hidePanel={hidePanel} completed />
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
    ReturnType<typeof useOnboardingTasks> {
  onClose: () => void;
}

export function NewOnboardingSidebar({
  onClose,
  orientation,
  collapsed,
  allTasks,
  gettingStartedTasks,
  beyondBasicsTasks,
}: NewSidebarProps) {
  const api = useApi();
  const organization = useOrganization();
  const walkthrough = isDemoWalkthrough();
  const {title, description} = getPanelDescription(walkthrough);

  const markCompletionTimeout = useRef<number | undefined>();
  const markCompletionSeenTimeout = useRef<number | undefined>();

  function completionTimeout(time: number): Promise<void> {
    window.clearTimeout(markCompletionTimeout.current);
    return new Promise(resolve => {
      markCompletionTimeout.current = window.setTimeout(resolve, time);
    });
  }

  function seenTimeout(time: number): Promise<void> {
    window.clearTimeout(markCompletionSeenTimeout.current);
    return new Promise(resolve => {
      markCompletionSeenTimeout.current = window.setTimeout(resolve, time);
    });
  }

  const markTasksAsSeen = useCallback(
    async function () {
      const unseenTasks = allTasks
        .filter(task => taskIsDone(task) && !task.completionSeen)
        .map(task => task.task);

      // Incrementally mark tasks as seen. This gives the card completion
      // animations time before we move each task into the completed section.
      for (const task of unseenTasks) {
        await seenTimeout(COMPLETION_SEEN_TIMEOUT);
        updateOnboardingTask(api, organization, {task, completionSeen: true});
      }
    },
    [api, organization, allTasks]
  );

  const markSeenOnOpen = useCallback(
    async function () {
      // Add a minor delay to marking tasks complete to account for the animation
      // opening of the sidebar panel
      await completionTimeout(INITIAL_MARK_COMPLETE_TIMEOUT);
      markTasksAsSeen();
    },
    [markTasksAsSeen]
  );

  useEffect(() => {
    markSeenOnOpen();

    return () => {
      window.clearTimeout(markCompletionTimeout.current);
      window.clearTimeout(markCompletionSeenTimeout.current);
    };
  }, [markSeenOnOpen]);

  return (
    <Wrapper
      collapsed={collapsed}
      hidePanel={onClose}
      orientation={orientation}
      title={title}
    >
      <Content>
        <p>{description}</p>
        <TaskGroup
          title={t('Getting Started')}
          description={t(
            'Learn the essentials to set up monitoring, capture errors, and track releases.'
          )}
          tasks={gettingStartedTasks}
          hidePanel={onClose}
          expanded={
            groupTasksByCompletion(gettingStartedTasks).incompletedTasks.length > 0
          }
        />
        <TaskGroup
          title={t('Beyond the Basics')}
          description={t(
            'Explore advanced features like release tracking, performance alerts and more to enhance your monitoring.'
          )}
          tasks={beyondBasicsTasks}
          hidePanel={onClose}
          expanded={
            groupTasksByCompletion(gettingStartedTasks).incompletedTasks.length === 0
          }
        />
      </Content>
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

const TaskGroupHeader = styled('div')`
  cursor: pointer;
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

const TaskWrapper = styled('div')<{completed?: boolean}>`
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

  ${p =>
    p.completed
      ? css`
          strong {
            opacity: 0.5;
          }
          align-items: center;
        `
      : css`
          position: relative;
          cursor: pointer;
          align-items: flex-start;
        `}
`;

const TaskActions = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
