import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css, keyframes} from 'react-emotion';
import * as Sentry from '@sentry/browser';

import {t, tct} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';
import Confirmation from 'app/components/onboardingWizard/confirmation';
import InlineSvg from 'app/components/inlineSvg';
import Button from 'app/components/button';
import space from 'app/styles/space';

class TodoItem extends React.Component {
  static propTypes = {
    task: PropTypes.object.isRequired,
    onSkip: PropTypes.func.isRequired,
    organization: SentryTypes.Organization,
  };

  state = {
    showConfirmation: false,
    isExpanded: false,
  };

  toggleDescription = () => {
    this.setState({isExpanded: !this.state.isExpanded});
  };

  toggleConfirmation = () => {
    this.setState({showConfirmation: !this.state.showConfirmation});
  };

  formatDescription() {
    const {task} = this.props;
    const {isExpanded, showConfirmation} = this.state;

    return (
      <React.Fragment>
        {task.description}
        {(isExpanded || showConfirmation) && '. ' + task.detailedDescription}
      </React.Fragment>
    );
  }

  learnMoreUrlCreator() {
    const org = this.props.organization;
    const {task} = this.props;
    let learnMoreUrl;
    if (task.featureLocation === 'project') {
      learnMoreUrl = `/organizations/${org.slug}/projects/choose/?onboarding=1&task=${
        task.task
      }`;
    } else if (task.featureLocation === 'organization') {
      learnMoreUrl = `/organizations/${org.slug}/${task.location}`;
    } else if (task.featureLocation === 'absolute') {
      learnMoreUrl = task.location;
    } else if (task.featureLocation === 'modal') {
      learnMoreUrl = undefined;
    } else {
      Sentry.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        Sentry.captureMessage('No learnMoreUrl created for this featureLocation');
      });
    }
    return learnMoreUrl;
  }

  recordAnalytics(action) {
    const {organization, task} = this.props;
    trackAnalyticsEvent({
      eventKey: 'onboarding.wizard_clicked',
      eventName: 'Onboarding Wizard Clicked',
      organization_id: organization.id,
      todo_id: parseInt(task.task, 10),
      todo_title: task.title,
      action,
    });
  }

  onSkip = task => {
    this.recordAnalytics('skipped');
    this.props.onSkip(task);
    this.setState({showConfirmation: false});
  };

  handleClick = e => {
    const {task} = this.props;

    if (task && task.featureLocation === 'modal' && typeof task.location === 'function') {
      task.location();
    }

    this.recordAnalytics('clickthrough');
    e.stopPropagation();
  };

  render() {
    const {task} = this.props;
    const {showConfirmation, isExpanded} = this.state;
    const learnMoreUrl = this.learnMoreUrlCreator();
    let description;

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
        description = this.formatDescription();
    }

    const showSkipButton =
      task.skippable &&
      task.status !== 'skipped' &&
      task.status !== 'complete' &&
      isExpanded &&
      !showConfirmation;

    return (
      <Item
        status={task.status}
        onMouseOver={this.toggleDescription}
        onMouseOut={this.toggleDescription}
      >
        <Content blur={showConfirmation}>
          <Checkbox>{task.status && <IndicatorIcon status={task.status} />}</Checkbox>
          <StyledLink
            href={learnMoreUrl}
            onClick={this.handleClick}
            data-test-id={task.task}
          >
            <ItemHeader status={task.status}>{task.title}</ItemHeader>
          </StyledLink>
          <Description>{description}</Description>
          <SkipButton
            size="xsmall"
            hide={!showSkipButton}
            onClick={this.toggleConfirmation}
          >
            {t('Skip task')}
          </SkipButton>
        </Content>
        <Confirmation
          task={task.task}
          onSkip={() => this.onSkip(task.task)}
          dismiss={this.toggleConfirmation}
          hide={!showConfirmation}
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

const Item = styled('li')`
  position: relative;
  padding: 15px 20px 15px 75px;
  line-height: 1.2;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: #fff;
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

const Content = styled('div')`
  position: relative;
  filter: ${p => p.blur && 'blur(3px)'};
`;

const Checkbox = styled('div')`
  height: 44px;
  width: 44px;
  background: #fff;
  border: 3px solid ${p => p.theme.borderDark};
  border-radius: 46px;
  position: absolute;
  top: -5px;
  left: -58px;
`;

const indicatorStyles = {
  skipped: ['icon-close', 'borderDark'],
  pending: ['icon-ellipsis', 'borderDark'],
  complete: ['icon-checkmark-sm', 'green'],
};

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
  line-height: 1.25em;
`;

const StyledLink = styled('a')`
  color: ${p => p.theme.blue};
  &:hover {
    color: ${p => p.theme.blueDark};
    text-decoration: underline;
  }
`;

const ItemHeader = styled('h4')`
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
  display: ${p => p.hide && 'none'};
  margin-top: ${space(1.5)};
`;

export default withOrganization(TodoItem);
