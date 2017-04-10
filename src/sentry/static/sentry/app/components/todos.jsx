import moment from 'moment';
import React from 'react';
import {t, tct} from '../locale';

import ApiMixin from '../mixins/apiMixin';
import OrganizationState from '../mixins/organizationState';

const TodoItem = React.createClass({
  propTypes: {
    task: React.PropTypes.object,
    onSkip: React.PropTypes.func.isRequired
  },

  mixins: [OrganizationState],

  getInitialState: function() {
    return {
      showConfirmation: false
    };
  },

  toggleConfirmation: function() {
    this.setState({showConfirmation: !this.state.showConfirmation});
  },

  skip: function(task) {
    this.props.onSkip(task);
    this.setState({showConfirmation: false});
  },

  render: function() {
    let org = this.getOrganization();

    let classNames = '';
    let description;

    switch(this.props.task.status) {
      case 'complete':
        classNames += ' checked';
        description = tct('[user] completed [dateCompleted]', {
          user: this.props.task.user,
          dateCompleted: moment(this.props.task.dateCompleted).fromNow(),
        });
        break;
      case 'pending':
        classNames += ' pending';
        description = tct('[user] kicked off [dateCompleted]', {
          user: this.props.task.user,
          dateCompleted: moment(this.props.task.dateCompleted).fromNow(),
        });
        break;
      case 'skipped':
        classNames += ' skipped';
        description = tct('[user] skipped [dateCompleted]', {
          user: this.props.task.user,
          dateCompleted: moment(this.props.task.dateCompleted).fromNow(),
        });
        break;
      default:
        description = this.props.task.description;
    }

    if (this.state.showConfirmation) {
      classNames += ' blur';
    }

    let learnMoreUrl = '';
    if (this.props.task.featureLocation === 'project') {
      learnMoreUrl = '/organizations/' + org.slug + '/projects/choose/?onboarding=1&task=' + this.props.task.task;
    } else if (this.props.task.featureLocation === 'organization') {
      learnMoreUrl = '/organizations/' + org.slug + '/' + this.props.task.location;
    } else if (this.props.task.featureLocation === 'absolute') {
      learnMoreUrl = this.props.task.location;
    }

    let showSkipButton = this.props.task.skippable && this.props.task.status != 'skipped' &&
      this.props.task.status != 'complete' && !this.state.showConfirmation;

    return (
      <li className={classNames}>
        { this.props.task.status == 'pending' && <div className="pending-bar" /> }
        <div className="todo-content">
          <div className="ob-checkbox">
            { this.props.task.status == 'complete' && <span className="icon-checkmark" /> }
            { this.props.task.status == 'skipped' && <span className="icon-x" /> }
            { this.props.task.status == 'pending' && <span className="icon-ellipsis" /> }
          </div>
          <a href={learnMoreUrl}><h4>{ this.props.task.title }</h4></a>
          <p>
            { description }
          </p>
          { showSkipButton && <a className="skip-btn btn btn-default" onClick={this.toggleConfirmation}>{t('Skip')}</a> }
        </div>
        { this.state.showConfirmation && <Confirmation task={this.props.task.task} onSkip={this.skip} dismiss={this.toggleConfirmation} /> }
      </li>
    );
  }
});

const Confirmation = React.createClass({
  propTypes: {
    task: React.PropTypes.number,
    onSkip: React.PropTypes.func.isRequired,
    dismiss: React.PropTypes.func.isRequired
  },

  skip: function(e) {
    e.preventDefault();
    this.props.onSkip(this.props.task);
  },

  dismiss: function() {
    this.props.dismiss();
  },

  render: function() {
    return (
      <div className="ob-confirmation" onClick={this.dismiss}>
        <h3>{t('Need help?')}</h3>
        <p><a href="mailto:support@sentry.io?subject=Help with onboarding">{t('Ask us!')}</a> &middot; <a onClick={this.skip}>{t('Skip')}</a></p>
      </div>
    );
  }
});

const TodoList = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  statics: {
    TASKS: [
      {
        'task': 1,
        'title': t('Create a project'),
        'description': t('Create your first Sentry project'),
        'skippable': false,
        'prereq': [],
        'featureLocation': 'organization',
        'location': 'projects/new/',
      },
      {
        'task': 2,
        'title': t('Send your first event'),
        'description': t('Install Sentry\'s client and send an event'),
        'skippable': false,
        'prereq': [1],
        'featureLocation': 'project',
        'location': 'settings/install/',
      },
      {
        'task': 3,
        'title': t('Invite team member'),
        'description': t('Bring your team aboard'),
        'skippable': true,
        'prereq': [],
        'featureLocation': 'organization',
        'location': 'members/',
      },
      {
        'task': 4,
        'title': t('Add a second platform'),
        'description': t('Add Sentry to a second platform'),
        'skippable': true,
        'prereq': [1, 2],
        'featureLocation': 'organization',
        'location': 'projects/new/',
      },
      {
        'task': 5,
        'title': t('Add user context'),
        'description': t('Know who is being affected by crashes'),
        'skippable': true,
        'prereq': [1, 2],
        'featureLocation': 'absolute',
        'location': 'https://docs.sentry.io/hosted/learn/context/#capturing-the-user',
      },
      {
        'task': 6,
        'title': t('Set up release tracking'),
        'description': t('See what releases are generating errors.'),
        'skippable': true,
        'prereq': [1, 2],
        'featureLocation': 'project',
        'location': 'settings/release-tracking/',
      },
      {
        'task': 7,
        'title': t('Upload sourcemaps'),
        'description': t('Deminify javascript stacktraces'),
        'skippable': true,
        'prereq': [1, 2], // Is one of the platforms javascript?
        'featureLocation': 'absolute',
        'location': 'https://docs.sentry.io/hosted/clients/javascript/sourcemaps/'
      },
      // {
      //   'task': 8,
      //   'title': 'User crash reports',
      //   'description': 'Collect user feedback when your application crashes',
      //   'skippable': false,
      //   'prereq': [1, 2, 5]
      //   'featureLocation': 'project',
      //   'location': 'settings/user-reports/'
      // },
      {
        'task': 9,
        'title': t('Set up issue tracking'),
        'description': t('Link to Sentry issues within your issue tracker'),
        'skippable': true,
        'prereq': [1, 2],
        'featureLocation': 'project',
        'location': 'settings/issue-tracking/',
      },
      {
        'task': 10,
        'title': t('Set up an alerts service'),
        'description': t('Receive Sentry alerts in Slack or HipChat'),
        'skippable': true,
        'prereq': [1, 2],
        'featureLocation': 'project',
        'location': 'settings/alerts/',
      },
    ]
  },

  getInitialState() {
    return {
      tasks: [],
      seeAll: false,  // Show all tasks, included those completed
    };
  },

  componentWillMount() {
    // Map server task state (who finished what) to TodoList.TASK objects
    let org = this.getOrganization();
    let tasks = TodoList.TASKS.map((task) => {
      for (let server_task of org.onboardingTasks) {
        if (server_task.task == task.task) {
          Object.assign(task, server_task);
          break;
        }
      }
      return task;
    });
    this.setState({tasks: tasks});
  },

  skipTask(skipped_task) {
    let org = this.getOrganization();
    this.api.request('/organizations/' + org.slug + '/onboarding-tasks/', {
      method: 'POST',
      data: {'task': skipped_task, 'status': 'skipped'},
      success: () => {
        let new_state = this.state.tasks.map( (task) => {
          if (task.task == skipped_task) {
            task.status = 'skipped';
          }
          return task;
        });
        this.setState({tasks: new_state});
      }
    });
    this.getOnboardingTasks();
  },

  click(e) {
    // e.preventDefault();
    e.stopPropagation();
  },

  render() {
    let nextTasks = this.state.tasks;

    let todo_list = nextTasks.map( (task) => {
      return (<TodoItem key={task.task} task={task} onSkip={this.skipTask} />);
    }, this);

    return (
      <div>
        <div onClick={this.click} className="onboarding-wrapper">
          <ul className="list-unstyled">
            {todo_list}
          </ul>
        </div>
      </div>
    );
  }
});

export default TodoList;
