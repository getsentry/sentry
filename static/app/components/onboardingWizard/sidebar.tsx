import {useCallback, useContext, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import HighlightTopRight from 'sentry-images/pattern/highlight-top-right.svg';

import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import {
  OnboardingContext,
  OnboardingContextProps,
} from 'sentry/components/onboarding/onboardingContext';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingTask, OnboardingTaskKey, Organization, Project} from 'sentry/types';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import withProjects from 'sentry/utils/withProjects';

import ProgressHeader from './progressHeader';
import Task from './task';
import {getMergedTasks} from './taskConfig';
import {findActiveTasks, findCompleteTasks, findUpcomingTasks, taskIsDone} from './utils';

type Props = Pick<CommonSidebarProps, 'orientation' | 'collapsed'> & {
  onClose: () => void;
  projects: Project[];
};

/**
 * How long (in ms) to delay before beginning to mark tasks complete
 */
const INITIAL_MARK_COMPLETE_TIMEOUT = 600;

/**
 * How long (in ms) to delay between marking each unseen task as complete.
 */
const COMPLETION_SEEN_TIMEOUT = 800;

const Heading = styled(motion.div)`
  display: flex;
  color: ${p => p.theme.activeText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
  font-weight: 600;
  line-height: 1;
  margin-top: ${space(3)};
`;

Heading.defaultProps = {
  layout: true,
  transition: testableTransition(),
};

const completeNowText = isDemoWalkthrough() ? t('Sentry Basics') : t('Next Steps');

const customizedTasksHeading = <Heading key="customized">{t('The Basics')}</Heading>;
const completeNowHeading = <Heading key="now">{completeNowText}</Heading>;
const upcomingTasksHeading = (
  <Heading key="upcoming">
    <Tooltip
      containerDisplayMode="block"
      title={t('Some tasks should be completed before completing these tasks')}
    >
      {t('Level Up')}
    </Tooltip>
  </Heading>
);
const completedTasksHeading = <Heading key="complete">{t('Completed')}</Heading>;

export const useOnboardingTasks = (
  organization: Organization,
  projects: Project[],
  onboardingContext: OnboardingContextProps
) => {
  return useMemo(() => {
    const all = getMergedTasks({
      organization,
      projects,
      onboardingContext,
    }).filter(task => task.display);
    const filteredTasks = all.filter(task => !task.renderCard);
    return {
      allTasks: all,
      customTasks: all.filter(task => task.renderCard),
      active: filteredTasks.filter(findActiveTasks),
      upcoming: filteredTasks.filter(findUpcomingTasks),
      complete: filteredTasks.filter(findCompleteTasks),
    };
  }, [organization, projects, onboardingContext]);
};

function OnboardingWizardSidebar({collapsed, orientation, onClose, projects}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);

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

  const {allTasks, customTasks, active, upcoming, complete} = useOnboardingTasks(
    organization,
    projects,
    onboardingContext
  );

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

  function makeTaskUpdater(status: OnboardingTask['status']) {
    return (task: OnboardingTaskKey) =>
      updateOnboardingTask(api, organization, {task, status, completionSeen: true});
  }

  function renderItem(task: OnboardingTask) {
    return (
      <AnimatedTaskItem
        task={task}
        key={`${task.task}`}
        onSkip={makeTaskUpdater('skipped')}
        onMarkComplete={makeTaskUpdater('complete')}
        hidePanel={onClose}
      />
    );
  }

  const completeList = (
    <CompleteList key="complete-group">
      <AnimatePresence initial={false}>{complete.map(renderItem)}</AnimatePresence>
    </CompleteList>
  );

  const customizedCards = customTasks
    .map(
      task =>
        task.renderCard?.({
          organization,
          task,
          onboardingContext,
          projects,
        })
    )
    .filter(card => !!card);

  const items = [
    customizedCards.length > 0 && customizedTasksHeading,
    ...customizedCards,
    active.length > 0 && completeNowHeading,
    ...active.map(renderItem),
    upcoming.length > 0 && upcomingTasksHeading,
    ...upcoming.map(renderItem),
    complete.length > 0 && completedTasksHeading,
    completeList,
  ];

  return (
    <TaskSidebarPanel collapsed={collapsed} hidePanel={onClose} orientation={orientation}>
      <TopRight src={HighlightTopRight} />
      <ProgressHeader allTasks={allTasks} completedTasks={complete} />
      <TaskList>
        <AnimatePresence initial={false}>{items}</AnimatePresence>
      </TaskList>
    </TaskSidebarPanel>
  );
}

const TaskSidebarPanel = styled(SidebarPanel)`
  width: 450px;
`;

const AnimatedTaskItem = motion(Task);

AnimatedTaskItem.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  layout: true,
  variants: {
    initial: {
      opacity: 0,
      y: 40,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: testableTransition({
        delay: 0.8,
        when: 'beforeChildren',
        staggerChildren: 0.3,
      }),
    },
    exit: {
      y: 20,
      z: -10,
      opacity: 0,
      transition: {duration: 0.2},
    },
  },
};

const TaskList = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(1)};
  margin: ${space(1)} ${space(4)} ${space(4)} ${space(4)};
`;

const CompleteList = styled('div')`
  display: grid;
  grid-auto-flow: row;

  > div {
    transition: border-radius 500ms;
  }

  > div:not(:first-of-type) {
    margin-top: -1px;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  > div:not(:last-of-type) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

const TopRight = styled('img')`
  position: absolute;
  top: 0;
  right: 0;
  width: 60%;
`;

export default withProjects(OnboardingWizardSidebar);
