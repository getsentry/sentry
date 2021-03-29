import React from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import HighlightTopRight from 'sentry-images/pattern/highlight-top-right.svg';

import {updateOnboardingTask} from 'app/actionCreators/onboardingTasks';
import {Client} from 'app/api';
import SidebarPanel from 'app/components/sidebar/sidebarPanel';
import {CommonSidebarProps} from 'app/components/sidebar/types';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OnboardingTask, OnboardingTaskKey, Organization} from 'app/types';
import testableTransition from 'app/utils/testableTransition';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import ProgressHeader from './progressHeader';
import Task from './task';
import {getMergedTasks} from './taskConfig';
import {findActiveTasks, findCompleteTasks, findUpcomingTasks, taskIsDone} from './utils';

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
  display: flex;
  color: ${p => p.theme.purple300};
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

const completeNowHeading = <Heading key="now">{t('The Basics')}</Heading>;
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
        <TopRight src={HighlightTopRight} />
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
  grid-gap: ${space(1)};
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

export default withApi(withOrganization(OnboardingWizardSidebar));
