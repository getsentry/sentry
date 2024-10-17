import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import {Chevron} from 'sentry/components/chevron';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {
  OnboardingContext,
  type OnboardingContextProps,
} from 'sentry/components/onboarding/onboardingContext';
import {findCompleteTasks, taskIsDone} from 'sentry/components/onboardingWizard/utils';
import ProgressRing from 'sentry/components/progressRing';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import DemoWalkthroughStore from 'sentry/stores/demoWalkthroughStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import {type OnboardingTask, OnboardingTaskGroup} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
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

function useOnboardingTasks(
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
      basicTasks: all.filter(task => task.group === OnboardingTaskGroup.BASIC),
    };
  }, [organization, projects, onboardingContext]);
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
  status?: 'waiting' | 'completed';
}

function Task({task, status, hidePanel}: TaskProps) {
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

  if (status === 'completed') {
    return (
      <TaskWrapper completed>
        <strong>{task.title}</strong>
        <IconCheckmark color="green300" isCircled />
      </TaskWrapper>
    );
  }

  if (status === 'waiting') {
    return (
      <TaskWrapper onClick={handleClick}>
        <InteractionStateLayer />
        <div>
          <strong>{task.title}</strong>
          <p>{task.description}</p>
        </div>
        <Tooltip title={t('Waiting for event')}>
          <PulsingIndicator />
        </Tooltip>
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
  const [completedTasks, incompletedTasks] = partition(tasks, task =>
    findCompleteTasks(task)
  );

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
                  <Task
                    key={task.task}
                    task={task}
                    hidePanel={hidePanel}
                    status="completed"
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

interface NewSidebarProps extends Pick<CommonSidebarProps, 'orientation' | 'collapsed'> {
  onClose: () => void;
}

export function NewOnboardingSidebar({onClose, orientation, collapsed}: NewSidebarProps) {
  const api = useApi();
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);
  const {projects} = useProjects();
  const walkthrough = isDemoWalkthrough();
  const {title, description} = getPanelDescription(walkthrough);
  const {allTasks, basicTasks} = useOnboardingTasks(
    organization,
    projects,
    onboardingContext
  );

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
        {basicTasks.length && (
          <TaskGroup
            title={t('The basics')}
            description={t(
              'Learn the essentials to set up monitoring, capture errors, and track releases.'
            )}
            tasks={basicTasks}
            hidePanel={onClose}
            expanded
          />
        )}
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
  align-items: center;
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
        `
      : css`
          position: relative;
          cursor: pointer;
        `}
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin: 0 ${space(0.5)};
`;
