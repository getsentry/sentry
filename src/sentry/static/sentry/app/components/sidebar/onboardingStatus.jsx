import PropTypes from 'prop-types';
import React from 'react';

import {analytics} from 'app/utils/analytics';
import {t} from '../../locale';
import SidebarPanel from './sidebarPanel';
import TodoList from '../onboardingWizard/todos';
import Tooltip from '../tooltip';

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
      (currentPanel || prevProps.currentPanel == 'todos')
    ) {
      this.recordAnalytics(currentPanel, parseInt(org.id, 10));
    }
  }

  recordAnalytics(currentPanel, orgId) {
    currentPanel === 'todos'
      ? analytics('onboarding.wizard_opened', {org_id: orgId})
      : analytics('onboarding.wizard_closed', {org_id: orgId});
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
    const allDisplayedTasks = TodoList.TASKS.filter(task => task.display);

    const percentage = Math.round(
      doneTasks.length / allDisplayedTasks.length * 100
    ).toString();

    const style = {
      height: collapsed ? percentage + '%' : undefined,
      width: collapsed ? undefined : percentage + '%',
    };

    if (doneTasks.length >= allDisplayedTasks.length) {
      return null;
    }

    return (
      <div className={currentPanel === 'todos' ? 'onboarding active' : 'onboarding'}>
        <Tooltip
          title={t(
            `Getting started with Sentry: <br />${doneTasks.length} / ${allDisplayedTasks.length} tasks completed`
          )}
          tooltipOptions={{html: true}}
        >
          <div
            data-test-id="onboarding-progress-bar"
            className="onboarding-progress-bar"
            onClick={onShowPanel}
          >
            <div className="slider" style={style} />
          </div>
        </Tooltip>
        {showPanel &&
          currentPanel === 'todos' && (
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
