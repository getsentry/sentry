import moment from 'moment';
import React from 'react';
import styled from '@emotion/styled';
import {css, keyframes} from '@emotion/core';
import * as ReactRouter from 'react-router';

import {t, tct} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withOrganization from 'app/utils/withOrganization';
import Confirmation from 'app/components/onboardingWizard/confirmation';
import InlineSvg from 'app/components/inlineSvg';
import Button from 'app/components/button';
import space from 'app/styles/space';
import ExternalLink from 'app/components/links/externalLink';
import {OnboardingTask, Organization, OnboardingTaskKey} from 'app/types';
import {navigateTo} from 'app/actionCreators/navigation';

type Props = ReactRouter.WithRouterProps & {
  task: OnboardingTask;
  onSkip: (taskKey: OnboardingTaskKey) => void;
  organization: Organization;
};

type State = {
  showConfirmation: boolean;
};

class TodoItem extends React.Component<Props, State> {
  state: State = {
    showConfirmation: false,
  };

  toggleConfirmation = () => {
    this.setState({showConfirmation: !this.state.showConfirmation});
  };

  get formattedDescription() {
    const {task} = this.props;
    return `${task.description}. ${task.detailedDescription}`;
  }

  recordAnalytics(action: string) {
    const {organization, task} = this.props;
    trackAnalyticsEvent({
      eventKey: 'onboarding.wizard_clicked',
      eventName: 'Onboarding Wizard Clicked',
      organization_id: organization.id,
      todo_id: task.task,
      todo_title: task.title,
      action,
    });
  }

  handleSkip = (taskKey: OnboardingTaskKey) => {
    this.recordAnalytics('skipped');
    this.props.onSkip(taskKey);
    this.setState({showConfirmation: false});
  };

  handleClick = (e: React.MouseEvent) => {
    const {task, router} = this.props;

    this.recordAnalytics('clickthrough');
    e.stopPropagation();

    if (task.actionType === 'external') {
      return;
    }

    if (task.actionType === 'action') {
      task.action();
    }

    if (task.actionType === 'app') {
      navigateTo(task.location, router);
    }
  };

  render() {
    const {task, organization} = this.props;
    const {showConfirmation} = this.state;

    let description: React.ReactNode;
    switch (task.status) {
      case 'complete':
        description = tct('[user] completed [dateCompleted]', {
          user: task.user,
          dateCompleted: moment(task.dateCompleted).fromNow(),
        });
        break;
      case 'pending':
        description = tct('[user] kicked off [dateCompleted]', {
          user: task.user,
          dateCompleted: moment(task.dateCompleted).fromNow(),
        });
        break;
      case 'skipped':
        description = tct('[user] skipped [dateCompleted]', {
          user: task.user,
          dateCompleted: moment(task.dateCompleted).fromNow(),
        });
        break;
      default:
        description = this.formattedDescription;
    }

    const showSkipButton =
      task.skippable && task.status !== 'skipped' && task.status !== 'complete';

    const Action = (p: React.HTMLAttributes<HTMLElement>) =>
      task.actionType === 'external' ? (
        <ActionExternalLink href={task.location} {...p} />
      ) : (
        <ActionTarget {...p} />
      );

    return (
      <Item status={task.status}>
        <Content blur={showConfirmation}>
          <Action onClick={this.handleClick} data-test-id={task.task}>
            <Checkbox status={task.status}>
              {task.status && <IndicatorIcon status={task.status} />}
            </Checkbox>
            <ItemHeader status={task.status}>{task.title}</ItemHeader>
            <Description>{description}</Description>
          </Action>
          {showSkipButton && (
            <SkipButton size="xsmall" onClick={this.toggleConfirmation}>
              {t('Skip task')}
            </SkipButton>
          )}
        </Content>
        <Confirmation
          hide={!showConfirmation}
          orgId={organization.slug}
          onSkip={() => this.handleSkip(task.task)}
          onDismiss={this.toggleConfirmation}
        />
      </Item>
    );
  }
}

export const animateStripes = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 60px 0;
  }
`;

const Item = styled('li')<{status: OnboardingTask['status']}>`
  position: relative;
  padding: 15px 20px 15px 75px;
  line-height: 1.2;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.white};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  font-size: 14px;

  ${p =>
    p.status === 'pending' &&
    css`
      background-size: 30px 30px;
      background-image: linear-gradient(
        135deg,
        rgba(0, 0, 0, 0.03) 25%,
        transparent 25%,
        transparent 50%,
        rgba(0, 0, 0, 0.03) 50%,
        rgba(0, 0, 0, 0.03) 75%,
        transparent 75%,
        transparent
      );
      animation: ${animateStripes} 3s linear infinite;
    `}
`;

const Content = styled('div')<{blur: boolean}>`
  position: relative;
  filter: ${p => p.blur && 'blur(3px)'};
`;

const indicatorStyles = {
  skipped: ['icon-close', 'borderDark'],
  pending: ['icon-ellipsis', 'borderDark'],
  complete: ['icon-checkmark-sm', 'green'],
};

const Checkbox = styled('div')<{status: OnboardingTask['status']}>`
  height: 44px;
  width: 44px;
  background: ${p => p.theme.white};
  border: 3px solid ${p => p.theme[indicatorStyles[p.status || 'pending'][1]]};
  border-radius: 46px;
  position: absolute;
  top: -5px;
  left: -58px;
`;

const IndicatorIcon = styled(({status, ...props}) => (
  <InlineSvg {...props} src={indicatorStyles[status][0]} />
))`
  position: relative;
  color: ${p => p.theme[indicatorStyles[p.status][1]]};
  font-size: 20px;
  top: 9px;
  left: 9px;
`;

const Description = styled('p')`
  margin: 0px;
  line-height: 1.5;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray3};
`;

const ActionExternalLink = styled(ExternalLink)`
  display: block;
`;

const ActionTarget = styled('div')`
  cursor: pointer;
`;

const ItemHeader = styled('h4')<{status: OnboardingTask['status']}>`
  color: ${p => p.theme.foreground};
  font-size: 16px;
  margin-bottom: 5px;

  ${p =>
    p.status === 'skipped' &&
    css`
      color: ${p.theme.gray2};
      text-decoration: line-through;
    `}
`;

const SkipButton = styled(Button)`
  margin-top: ${space(1.5)};
`;

// XXX(epurkhiser): The withRouter HoC has incorrect typings. It does not
// correctly remove the WithRouterProps from the return type of the HoC, thus
// we manually have to do this.
type PropsWithoutRouter = Omit<Props, keyof ReactRouter.WithRouterProps>;

export default withOrganization(
  ReactRouter.withRouter(TodoItem) as React.ComponentClass<PropsWithoutRouter>
);
