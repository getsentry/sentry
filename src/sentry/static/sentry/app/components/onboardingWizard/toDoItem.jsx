import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import classNames from 'classnames';
import * as Sentry from '@sentry/browser';

import {t, tct} from 'app/locale';
import {analytics} from 'app/utils/analytics';
import OrganizationState from 'app/mixins/organizationState';
import Confirmation from 'app/components/onboardingWizard/confirmation';

const TodoItem = createReactClass({
  displayName: 'TodoItem',

  propTypes: {
    task: PropTypes.object.isRequired,
    onSkip: PropTypes.func.isRequired,
  },

  mixins: [OrganizationState],

  getInitialState() {
    return {
      showConfirmation: false,
      isExpanded: false,
    };
  },

  toggleDescription() {
    this.setState({isExpanded: !this.state.isExpanded});
  },

  toggleConfirmation() {
    this.setState({showConfirmation: !this.state.showConfirmation});
  },

  formatDescription() {
    const {task} = this.props;
    const {isExpanded} = this.state;

    return (
      <p>
        {task.description} {isExpanded && '. ' + task.detailedDescription}
      </p>
    );
  },

  learnMoreUrlCreator() {
    const org = this.getOrganization();
    const {task} = this.props;
    let learnMoreUrl;
    if (task.featureLocation === 'project') {
      learnMoreUrl = `/organizations/${org.slug}/projects/choose/?onboarding=1&task=${task.task}`;
    } else if (task.featureLocation === 'organization') {
      learnMoreUrl = `/organizations/${org.slug}/${task.location}`;
    } else if (task.featureLocation === 'absolute') {
      learnMoreUrl = task.location;
    } else {
      Sentry.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        Sentry.captureMessage('No learnMoreUrl created for this featureLocation');
      });
    }
    return learnMoreUrl;
  },

  recordAnalytics(action) {
    const org = this.getOrganization();
    const {task} = this.props;
    analytics('onboarding.wizard_clicked', {
      org_id: parseInt(org.id, 10),
      todo_id: parseInt(task.task, 10),
      todo_title: task.title,
      action,
    });
  },

  onSkip(task) {
    this.recordAnalytics('skipped');
    this.props.onSkip(task);
    this.setState({showConfirmation: false});
  },

  handleClick(e) {
    this.recordAnalytics('clickthrough');
    e.stopPropagation();
  },

  render() {
    const {task, className} = this.props;
    const {showConfirmation} = this.state;
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

    const classes = classNames(className, task.status, {
      blur: showConfirmation,
    });

    const showSkipButton =
      task.skippable &&
      task.status !== 'skipped' &&
      task.status !== 'complete' &&
      !showConfirmation;

    return (
      <li
        className={classes}
        onMouseOver={this.toggleDescription}
        onMouseOut={this.toggleDescription}
      >
        {task.status === 'pending' && <div className="pending-bar" />}
        <div className="todo-content">
          <div className="ob-checkbox">
            {task.status === 'complete' && <span className="icon-checkmark" />}
            {task.status === 'skipped' && <span className="icon-x" />}
            {task.status === 'pending' && <span className="icon-ellipsis" />}
          </div>
          <a href={learnMoreUrl} onClick={this.handleClick}>
            <h4>{task.title}</h4>
          </a>
          <div>{description}</div>
          {showSkipButton && (
            <a className="skip-btn btn btn-default" onClick={this.toggleConfirmation}>
              {t('Skip')}
            </a>
          )}
        </div>
        {showConfirmation && (
          <Confirmation
            task={task.task}
            onSkip={() => this.onSkip(task.task)}
            dismiss={this.toggleConfirmation}
          />
        )}
      </li>
    );
  },
});

export default TodoItem;
