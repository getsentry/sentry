import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import getOnboardingTasks from 'app/components/onboardingWizard/getOnboardingTasks';
import SidebarPanel from 'app/components/sidebar/sidebarPanel';
import {tct} from 'app/locale';
import TodoList from 'app/components/onboardingWizard/todoList';
import Tooltip from 'app/components/tooltip';
import {Organization} from 'app/types';

type Props = {
  org: Organization;
  currentPanel: string;
  onShowPanel: () => void;
  hidePanel: () => void;
  showPanel: boolean;
  collapsed: boolean;
};

function recordAnalytics(currentPanel: string, orgId: string) {
  const data =
    currentPanel === 'todos'
      ? {eventKey: 'onboarding.wizard_opened', eventName: 'Onboarding Wizard Opened'}
      : {eventKey: 'onboarding.wizard_closed', eventName: 'Onboarding Wizard Closed'};
  trackAnalyticsEvent({...data, organization_id: orgId});
}

class OnboardingStatus extends React.Component<Props> {
  static propTypes = {
    org: PropTypes.object.isRequired,
    currentPanel: PropTypes.string,
    onShowPanel: PropTypes.func,
    showPanel: PropTypes.bool,
    hidePanel: PropTypes.func,
    collapsed: PropTypes.bool,
  };

  componentDidUpdate(prevProps: Props) {
    const {currentPanel, org} = this.props;
    if (
      currentPanel !== prevProps.currentPanel &&
      (currentPanel || prevProps.currentPanel === 'todos')
    ) {
      recordAnalytics(currentPanel, org.id);
    }
  }

  render() {
    const {collapsed, org, currentPanel, hidePanel, showPanel, onShowPanel} = this.props;

    if (!(org.features && org.features.includes('onboarding'))) {
      return null;
    }

    const doneTasks = (org.onboardingTasks || []).filter(
      task => task.status === 'complete' || task.status === 'skipped'
    );

    const tasks = getOnboardingTasks(org);
    const allDisplayedTasks = tasks.filter(task => task.display);

    if (doneTasks.length >= allDisplayedTasks.length) {
      return null;
    }

    const tooltipTitle = tct(
      'Getting started with Sentry: [br] [done] / [all] tasks completed',
      {
        br: <br />,
        done: doneTasks.length,
        all: allDisplayedTasks.length,
      }
    );

    return (
      <React.Fragment>
        <Tooltip title={tooltipTitle} containerDisplayMode="block">
          <OnboardingProgressBar
            onClick={onShowPanel}
            isActive={currentPanel === 'todos'}
            isCollapsed={collapsed}
            progress={Math.round((doneTasks.length / allDisplayedTasks.length) * 100)}
          />
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
      </React.Fragment>
    );
  }
}

const hoverBg = css`
  background: rgba(255, 255, 255, 0.3);
`;

const OnboardingProgressBar = styled('div')<{
  isActive: boolean;
  isCollapsed: boolean;
  progress: number;
}>`
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
  z-index: 200;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;

  width: ${p => (p.isCollapsed ? '16px' : '100%')};
  height: ${p => (p.isCollapsed ? '150px' : '16px')};

  ${p => p.isActive && hoverBg};

  &:hover {
    ${hoverBg}
    background: rgba(255, 255, 255, 0.3);
  }

  &:before {
    content: '';
    display: block;
    position: absolute;
    top: -10px;
    bottom: -10px;
    left: -10px;
    right: -10px;
  }

  &:after {
    content: '';
    display: block;
    border-radius: inherit;
    background-color: ${p => p.theme.green};

    width: ${p => (p.isCollapsed ? '100%' : `${p.progress}%`)};
    height: ${p => (p.isCollapsed ? `${p.progress}%` : '100%')};
  }
`;

export default OnboardingStatus;
