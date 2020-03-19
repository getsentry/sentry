import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getMergedTasks} from 'app/components/onboardingWizard/taskConfig';
import {tct, t} from 'app/locale';
import OnboardingSidebar from 'app/components/onboardingWizard/sidebar';
import {Organization, OnboardingTaskStatus} from 'app/types';
import space from 'app/styles/space';
import theme, {Theme} from 'app/utils/theme';
import ProgressRing, {
  RingBackground,
  RingBar,
  RingText,
} from 'app/components/progressRing';

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

const isDone = (task: OnboardingTaskStatus) =>
  task.status === 'complete' || task.status === 'skipped';

const progressTextCss = () => css`
  font-size: ${theme.fontSizeMedium};
  font-weight: bold;
`;

class OnboardingStatus extends React.Component<Props> {
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

    const tasks = getMergedTasks(org);

    const allDisplayedTasks = tasks.filter(task => task.display);
    const doneTasks = allDisplayedTasks.filter(isDone);
    const numberRemaining = allDisplayedTasks.length - doneTasks.length;

    const pendingCompletionSeen = doneTasks.some(
      task =>
        allDisplayedTasks.some(displayedTask => displayedTask.task === task.task) &&
        task.status === 'complete' &&
        !task.completionSeen
    );

    const isActive = showPanel && currentPanel === 'todos';

    if (doneTasks.length >= allDisplayedTasks.length && !isActive) {
      return null;
    }

    return (
      <React.Fragment>
        <Container onClick={onShowPanel} isActive={isActive}>
          <ProgressRing
            animateText
            textCss={progressTextCss}
            text={allDisplayedTasks.length - doneTasks.length}
            value={(doneTasks.length / allDisplayedTasks.length) * 100}
            backgroundColor="rgba(255, 255, 255, 0.15)"
            progressEndcaps="round"
            size={38}
            barWidth={6}
          />
          {!collapsed && (
            <div>
              <Heading>{t('Setup Sentry')}</Heading>
              <Remaining>
                {tct('[numberRemaining] Remaining tasks', {numberRemaining})}
                {pendingCompletionSeen && <PendingSeenIndicator />}
              </Remaining>
            </div>
          )}
        </Container>
        {isActive && <OnboardingSidebar collapsed={collapsed} onClose={hidePanel} />}
      </React.Fragment>
    );
  }
}

const Heading = styled('div')`
  transition: color 100ms;
  font-size: ${p => p.theme.offWhite};
  color: ${p => p.theme.gray1};
  margin-bottom: ${space(0.25)};
`;

const Remaining = styled('div')`
  transition: color 100ms;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray2};
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(0.75)};
  align-items: center;
`;

const PendingSeenIndicator = styled('div')`
  background: ${p => p.theme.red};
  border-radius: 50%;
  height: 7px;
  width: 7px;
`;

const hoverCss = (p: {theme: Theme}) => css`
  background: rgba(255, 255, 255, 0.05);

  ${RingBackground} {
    stroke: rgba(255, 255, 255, 0.3);
  }
  ${RingBar} {
    stroke: ${p.theme.greenLight};
  }
  ${RingText} {
    color: ${p.theme.white};
  }

  ${Heading} {
    color: ${p.theme.white};
  }
  ${Remaining} {
    color: ${p.theme.gray1};
  }
`;

const Container = styled('div')<{isActive: boolean}>`
  padding: 9px 19px 9px 16px;
  cursor: pointer;
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1.5)};
  align-items: center;
  transition: background 100ms;

  ${p => p.isActive && hoverCss(p)};

  &:hover {
    ${hoverCss};
  }
`;

export default OnboardingStatus;
