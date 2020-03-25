import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getOnboardingTasks} from 'app/components/onboardingWizard/taskConfig';
import SidebarPanel from 'app/components/sidebar/sidebarPanel';
import {tct, t} from 'app/locale';
import TodoList from 'app/components/onboardingWizard/todoList';
import Tooltip from 'app/components/tooltip';
import {Organization} from 'app/types';
import {CommonSidebarProps} from 'app/components/sidebar/types';

type Props = CommonSidebarProps & {
  org: Organization;
};

class LegacyOnboardingStatus extends React.Component<Props> {
  static propTypes = {
    org: PropTypes.object.isRequired,
    currentPanel: PropTypes.string,
    onShowPanel: PropTypes.func,
    showPanel: PropTypes.bool,
    hidePanel: PropTypes.func,
    collapsed: PropTypes.bool,
  };

  handleShowPanel = () => {
    const {org, onShowPanel} = this.props;

    trackAnalyticsEvent({
      eventKey: 'onboarding.wizard_opened',
      eventName: 'Onboarding Wizard Opened',
      organization_id: org.id,
    });
    onShowPanel();
  };

  render() {
    const {collapsed, org, currentPanel, orientation, hidePanel, showPanel} = this.props;

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
            onClick={this.handleShowPanel}
            isActive={currentPanel === 'todos'}
            isCollapsed={collapsed}
            progress={Math.round((doneTasks.length / allDisplayedTasks.length) * 100)}
          />
        </Tooltip>
        {showPanel && currentPanel === 'todos' && (
          <SidebarPanel
            collapsed={collapsed}
            orientation={orientation}
            title={t('Getting Started with Sentry')}
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

export default LegacyOnboardingStatus;
