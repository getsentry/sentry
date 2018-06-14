import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import classNames from 'classnames';
import {t, tct} from 'app/locale';

import analytics from 'app/utils/analytics';
import OrganizationState from 'app/mixins/organizationState';
import Confirmation from 'app/components/onboardingWizard/confirmation';

const TodoItem = createReactClass({
  displayName: 'TodoItem',

  propTypes: {
    task: PropTypes.object.isRequired,
    onSkip: PropTypes.func.isRequired,
  },

  mixins: [OrganizationState],

  getInitialState: function() {
    return {
      showConfirmation: false,
      isExpanded: false,
      org: this.getOrganization(),
    };
  },

  toggleDescription() {
    this.setState({isExpanded: !this.state.isExpanded});
  },

  toggleConfirmation: function() {
    this.setState({showConfirmation: !this.state.showConfirmation});
  },

  formatDescription: function() {
    return (
      <p>
        {this.props.task.description}{' '}
        {this.state.isExpanded && '. ' + this.props.task.detailedDescription}
      </p>
    );
  },

  learnMoreUrlCreator: function() {
    let {org} = this.state;
    let learnMoreUrl;
    if (this.props.task.featureLocation === 'project') {
      learnMoreUrl = `/organizations/${org.slug}/projects/choose/?onboarding=1&task=${this
        .props.task.task}`;
    } else if (this.props.task.featureLocation === 'organization') {
      learnMoreUrl = `/organizations/${org.slug}/${this.props.task.location}`;
    } else if (this.props.task.featureLocation === 'absolute') {
      learnMoreUrl = this.props.task.location;
    } else {
      Raven.captureMessage('No learnMoreUrl created for this featureLocation ', {
        extra: {props: this.props, state: this.state},
      });
    }
    return learnMoreUrl;
  },

  recordAnalytics() {
    let {org} = this.state;
    let {task} = this.props;

    analytics('onboarding.wizard_clicked', {
      org_id: parseInt(org.id, 10),
      todo_id: parseInt(task.task, 10),
      todo_title: task.title,
      action: 'skipped',
    });
  },

  skip: function(task) {
    this.props.onSkip(task);
    this.setState({showConfirmation: false});
    this.recordAnalytics();
  },

  render: function() {
    let learnMoreUrl = this.learnMoreUrlCreator();
    let description;

    switch (this.props.task.status) {
      case 'complete':
        description = tct('[user] completed [dateCompleted]', {
          user: this.props.task.user,
          dateCompleted: moment(this.props.task.dateCompleted).fromNow(),
        });
        break;
      case 'pending':
        description = tct('[user] kicked off [dateCompleted]', {
          user: this.props.task.user,
          dateCompleted: moment(this.props.task.dateCompleted).fromNow(),
        });
        break;
      case 'skipped':
        description = tct('[user] skipped [dateCompleted]', {
          user: this.props.task.user,
          dateCompleted: moment(this.props.task.dateCompleted).fromNow(),
        });
        break;
      default:
        description = this.formatDescription();
    }

    let classes = classNames(this.props.className, this.props.task.status, {
      blur: this.state.showConfirmation,
    });

    let showSkipButton =
      this.props.task.skippable &&
      this.props.task.status != 'skipped' &&
      this.props.task.status != 'complete' &&
      !this.state.showConfirmation;

    return (
      <li
        className={classes}
        onMouseOver={this.toggleDescription}
        onMouseOut={this.toggleDescription}
      >
        {this.props.task.status == 'pending' && <div className="pending-bar" />}
        <div className="todo-content">
          <div className="ob-checkbox">
            {this.props.task.status == 'complete' && <span className="icon-checkmark" />}
            {this.props.task.status == 'skipped' && <span className="icon-x" />}
            {this.props.task.status == 'pending' && <span className="icon-ellipsis" />}
          </div>
          <a href={learnMoreUrl}>
            <h4>{this.props.task.title}</h4>
          </a>
          <div>{description}</div>

          {showSkipButton && (
            <a className="skip-btn btn btn-default" onClick={this.toggleConfirmation}>
              {t('Skip')}
            </a>
          )}
        </div>
        {this.state.showConfirmation && (
          <Confirmation
            task={this.props.task.task}
            onSkip={() => this.skip(this.props.task.task)}
            dismiss={this.toggleConfirmation}
          />
        )}
      </li>
    );
  },
});

export default TodoItem;
