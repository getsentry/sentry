import PropTypes from 'prop-types';
import React from 'react';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import getOnboardingTasks from 'app/components/onboardingWizard/getOnboardingTasks';
import SidebarPanel from 'app/components/sidebar/sidebarPanel';
import {tct} from 'app/locale';
import TodoList from 'app/components/onboardingWizard/todoList';
import Tooltip from 'app/components/tooltip';

class OnboardingStatus extends React.Component {
  static propTypes = {
    org: PropTypes.object.isRequired,
    currentPanel: PropTypes.string,
    onShowPanel: PropTypes.func,
    showPanel: PropTypes.bool,
    hidePanel: PropTypes.func,
    collapsed: PropTypes.bool,
  };

  componentDidUpdate(prevProps) {
    const {currentPanel, org} = this.props;
    if (
      currentPanel !== prevProps.currentPanel &&
      (currentPanel || prevProps.currentPanel === 'todos')
    ) {
      this.recordAnalytics(currentPanel, parseInt(org.id, 10));
    }
  }

  recordAnalytics(currentPanel, orgId) {
    const data =
      currentPanel === 'todos'
        ? {
            eventKey: 'onboarding.wizard_opened',
            eventName: 'Onboarding Wizard Opened',
          }
        : {
            eventKey: 'onboarding.wizard_closed',
            eventName: 'Onboarding Wizard Closed',
          };
    trackAnalyticsEvent({
      ...data,
      organization_id: orgId,
    });
  }

  render() {
    const {collapsed, org, currentPanel, hidePanel, showPanel, onShowPanel} = this.props;
    if (
      typeof org.features === 'undefined' ||
      org.features.indexOf('onboarding') === -1
    ) {
      return null;
    }

    const doneTasks = (org.onboardingTasks || []).filter(
      task => task.status === 'complete' || task.status === 'skipped'
    );

    const tasks = getOnboardingTasks(org);
    const allDisplayedTasks = tasks.filter(task => task.display);

    const percentage = Math.round(
      (doneTasks.length / allDisplayedTasks.length) * 100
    ).toString();

    const style = {
      height: collapsed ? percentage + '%' : undefined,
      width: collapsed ? undefined : percentage + '%',
    };

    if (doneTasks.length >= allDisplayedTasks.length) {
      return null;
    }
    const title = tct(
      'Getting started with Sentry: [br] [done] / [all] tasks completed',
      {
        br: <br />,
        done: doneTasks.length,
        all: allDisplayedTasks.length,
      }
    );

    return (
      <div className={currentPanel === 'todos' ? 'onboarding active' : 'onboarding'}>
        <Tooltip title={title}>
          <div
            data-test-id="onboarding-progress-bar"
            className="onboarding-progress-bar"
            onClick={onShowPanel}
          >
            <div className="slider" style={style} />
          </div>
        </Tooltip>
        {showPanel && currentPanel === 'todos' && (
          <SidebarPanel
            collapsed={collapsed}
            title="Getting Started with Sentry"
            hidePanel={hidePanel}
          >
            <TodoList />
          </SidebarPanel>
        )}
      </div>
    );
  }
}

export default OnboardingStatus;
