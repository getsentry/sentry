import React from 'react';
import styled from '@emotion/styled';
import {motion, AnimatePresence} from 'framer-motion';

import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {Client} from 'app/api';
import {Organization, OnboardingTask, OnboardingTaskKey} from 'app/types';
import {updateOnboardingTask} from 'app/actionCreators/onboardingTasks';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {IconLightning, IconLock, IconCheckmark} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import SidebarPanel from 'app/components/sidebar/sidebarPanel';
import {CommonSidebarProps} from 'app/components/sidebar/types';
import testableTransition from 'app/utils/testableTransition';

import {findUpcomingTasks, findCompleteTasks, findActiveTasks, taskIsDone} from './utils';
import {getMergedTasks} from './taskConfig';
import Task from './task';
import ProgressHeader from './progressHeader';

type Props = Pick<CommonSidebarProps, 'orientation' | 'collapsed'> & {
  api: Client;
  organization: Organization;
  onClose: () => void;
};

/**
 * How long (in ms) to delay before beginning to mark tasks complete
 */
const INITIAL_MARK_COMPLETE_TIMEOUT = 600;

/**
 * How long (in ms) to delay between marking each unseen task as complete.
 */
const COMPLETION_SEEN_TIMEOUT = 800;

const doTimeout = (timeout: number) =>
  new Promise(resolve => setTimeout(resolve, timeout));

const Heading = styled(motion.div)`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(0.75)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  font-weight: normal;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  color: ${p => p.theme.gray600};
  padding-bottom: ${space(1)};
`;

Heading.defaultProps = {
  positionTransition: true,
  transition: testableTransition(),
};

const completeNowHeading = (
  <Heading key="now">
    <IconLightning size="xs" />
    {t('Complete now')}
  </Heading>
);
const upcomingTasksHeading = (
  <Heading key="upcoming">
    <Tooltip
      containerDisplayMode="block"
      title={t('Some tasks should be completed before completing these tasks')}
    >
      <IconLock size="xs" />
    </Tooltip>
    {t('Upcoming tasks')}
  </Heading>
);
const completedTasksHeading = (
  <Heading key="complete">
    <IconCheckmark size="xs" />
    {t('Completed tasks')}
  </Heading>
);

class OnboardingWizardSidebar extends React.Component<Props> {
  async componentDidMount() {
    // Add a minor delay to marking tasks complete to account for the animation
    // opening of the sidebar panel
    await doTimeout(INITIAL_MARK_COMPLETE_TIMEOUT);
    this.markTasksAsSeen();
  }

  async markTasksAsSeen() {
    const unseenTasks = this.segmentedTasks.all
      .filter(task => taskIsDone(task) && !task.completionSeen)
      .map(task => task.task);

    // Incrementally mark tasks as seen. This gives the card completion
    // animations time before we move each task into the completed section.
    for (const task of unseenTasks) {
      await doTimeout(COMPLETION_SEEN_TIMEOUT);

      const {api, organization} = this.props;
      updateOnboardingTask(api, organization, {
        task,
        completionSeen: true,
      });
    }
  }

  get segmentedTasks() {
    const {organization} = this.props;
    const all = getMergedTasks(organization).filter(task => task.display);

    const active = all.filter(findActiveTasks);
    const upcoming = all.filter(findUpcomingTasks);
    const complete = all.filter(findCompleteTasks);

    return {active, upcoming, complete, all};
  }

  makeTaskUpdater = (status: OnboardingTask['status']) => (task: OnboardingTaskKey) => {
    const {api, organization} = this.props;
    updateOnboardingTask(api, organization, {task, status, completionSeen: true});
  };

  renderItem = (task: OnboardingTask) => (
    <AnimatedTaskItem
      task={task}
      key={`${task.task}`}
      onSkip={this.makeTaskUpdater('skipped')}
      onMarkComplete={this.makeTaskUpdater('complete')}
    />
  );

  render() {
    const {collapsed, orientation, onClose} = this.props;
    const {all, active, upcoming, complete} = this.segmentedTasks;

    const completeList = (
      <CompleteList key="complete-group">
        <AnimatePresence initial={false}>{complete.map(this.renderItem)}</AnimatePresence>
      </CompleteList>
    );

    const items = [
      active.length > 0 && completeNowHeading,
      ...active.map(this.renderItem),
      upcoming.length > 0 && upcomingTasksHeading,
      ...upcoming.map(this.renderItem),
      complete.length > 0 && completedTasksHeading,
      completeList,
    ];

    return (
      <TaskSidebarPanel
        collapsed={collapsed}
        hidePanel={onClose}
        orientation={orientation}
      >
        <ProgressHeader allTasks={all} completedTasks={complete} />
        <TaskList>
          <AnimatePresence initial={false}>{items}</AnimatePresence>
        </TaskList>
      </TaskSidebarPanel>
    );
  }
}
const TaskSidebarPanel = styled(SidebarPanel)`
  width: 450px;
`;

const AnimatedTaskItem = motion.custom(Task);

AnimatedTaskItem.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  positionTransition: true,
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
  grid-gap: ${space(2)};
  margin: 0 ${space(4)};
  margin-bottom: ${space(4)};
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

export default withApi(withOrganization(OnboardingWizardSidebar));
