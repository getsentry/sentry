import moment from 'moment';
import React from 'react';
import {t, tct} from '../locale';

import ApiMixin from '../mixins/apiMixin';
import OrganizationState from '../mixins/organizationState';

const TodoItem = React.createClass({
  propTypes: {
    task: React.PropTypes.object,
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
      case 'Complete':
        classNames += ' checked';
        description = tct('[user] completed [dateCompleted]', {
          user: this.props.task.user,
          dateCompleted: moment(this.props.task.dateCompleted).fromNow(),
        });
        break;
      case 'Pending':
        classNames += ' pending';
        description = tct('[user] kicked off [dateCompleted]', {
          user: this.props.task.user,
          dateCompleted: moment(this.props.task.dateCompleted).fromNow(),
        });
        break;
      case 'Skipped':
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

    let learn_more_url = '';
    if (this.props.task.feature_location === 'project') {
      learn_more_url = '/organizations/' + org.slug + '/projects/choose/?next=' + this.props.task.location;
    } else if (this.props.task.feature_location === 'organization') {
      learn_more_url = '/organizations/' + org.slug + '/' + this.props.task.location;
    } else if (this.props.task.feature_location === 'absolute') {
      learn_more_url = this.props.task.location;
    }

    let showSkipButton = this.props.task.skippable && this.props.task.status != 'Skipped' &&
      this.props.task.status != 'Complete' && !this.state.showConfirmation;

    return (
      <li className={classNames}>
        { this.props.task.status == 'Pending' && <span className="pending-bar" /> }
        <div className="todo-content">
          <div className="ob-checkbox">
            { this.props.task.status == 'Complete' && <span className="icon-checkmark" /> }
            { this.props.task.status == 'Skipped' && <span className="icon-x" /> }
            { this.props.task.status == 'Pending' && <span className="icon-ellipsis" /> }
          </div>
          <a href={learn_more_url}><h4>{ this.props.task.title }</h4></a>
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
    task: React.PropTypes.string,
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
        <p><a href="mailto:support@getsentry.com?subject=Help with onboarding">{t('Ask us!')}</a> &middot; <a onClick={this.skip}>{t('Skip')}</a></p>
      </div>
    );
  }
});

const TodoList = React.createClass({
  propTypes: {
    onClose: React.PropTypes.func
  },

  mixins: [ApiMixin, OrganizationState],

  statics: {
    TASKS: [
      {
        'task': 1,
        'title': t('Create a project'),
        'description': t('Create your first Sentry project'),
        'skippable': false,
        'prereq': [],
        'feature_location': 'organization',
        'location': 'projects/new/',
      },
      {
        'task': 2,
        'title': t('Send your first event'),
        'description': t('Install Sentry\'s client and send an event'),
        'skippable': false,
        'prereq': [1],
        'feature_location': 'project',
        'location': 'install',
      },
      {
        'task': 3,
        'title': t('Invite team member'),
        'description': t('Bring your team aboard'),
        'skippable': false,
        'prereq': [],
        'feature_location': 'organization',
        'location': 'members/',
      },
      {
        'task': 4,
        'title': t('Add a second platform'),
        'description': t('Add Sentry to a second platform'),
        'skippable': false,
        'prereq': [1, 2],
        'feature_location': 'organization',
        'location': 'projects/new/',
      },
      {
        'task': 5,
        'title': t('Add user context'),
        'description': t('Know who is being affected by crashes'),
        'skippable': false,
        'prereq': [1, 2],
        'feature_location': 'absolute',
        'location': 'https://docs.getsentry.com/hosted/learn/context/#capturing-the-user',
      },
      {
        'task': 6,
        'title': t('Set up release tracking'),
        'description': t('See what releases are generating errors.'),
        'skippable': false,
        'prereq': [1, 2],
        'feature_location': 'project',
        'location': 'release-tracking',
      },
      {
        'task': 7,
        'title': t('Upload sourcemaps'),
        'description': t('Deminify javascript stacktraces'),
        'skippable': false,
        'prereq': [1, 2, 8], // Is one of the platforms javascript?
        'feature_location': 'absolute',
        'location': 'https://docs.getsentry.com/hosted/clients/javascript/sourcemaps/'
      },
      // {
      //   'task': 8,
      //   'title': 'User crash reports',
      //   'description': 'Collect user feedback when your application crashes',
      //   'skippable': false,
      //   'prereq': [1, 2, 5]
      //   'feature_location': 'project',
      //   'location': 'settings/user-reports/'
      // },
      {
        'task': 9,
        'title': t('Set up issue tracking'),
        'description': t('Link to Sentry issues within your issue tracker'),
        'skippable': true,
        'prereq': [1, 2],
        'feature_location': 'project',
        'location': 'issue-tracking',
      },
      {
        'task': 10,
        'title': t('Set up a notification service'),
        'description': t('Receive Sentry alerts in Slack or HipChat'),
        'skippable': true,
        'prereq': [1, 2],
        'feature_location': 'project',
        'location': 'notification',
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

  componentDidMount() {
    // If a click is detected *outside* the TodoList, trigger
    // the onClose handler
    this.clickHandler = $('body').on('click', (e) => {
      if (!$(e.target).closest('.onboarding-progress-bar').length) {
        this.props.onClose();
      }
    });
  },

  componentWillUnmount() {
    $('body').off('click', this.clickHandler);
  },

  skipTask(skipped_task) {
    let org = this.getOrganization();
    this.api.request('/organizations/' + org.slug + '/onboarding-tasks/', {
      method: 'POST',
      data: {'task': skipped_task, 'status': 'Skipped'},
      success: () => {
        let new_state = this.state.tasks.map( (task) => {
          if (task.task == skipped_task) {
            task.status = 'Skipped';
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

  toggleSeeAll(e) {
    this.setState({seeAll: !this.state.seeAll});
  },

  render() {
    let next_tasks = [];
    if (this.state.seeAll) {
      next_tasks = this.state.tasks;
    } else {
      next_tasks = this.state.tasks.filter( (task) => {
        if (task.status != 'Complete') {
          return task;
        }
      }).slice(0,3);
    }

    let todo_list = next_tasks.map( (task) => {
      return (<TodoItem key={task.task} task={task} onSkip={this.skipTask} />);
    }, this);

    return (
      <div>
        <div onClick={this.click} className="onboarding-wrapper">
          <h3>{t('Getting started with Sentry')}</h3>
          <ul className="list-unstyled">
            {todo_list}
          </ul>
          <a className="btn btn-default btn-see-all" onClick={this.toggleSeeAll}>{this.state.seeAll ? t('Show less') : t('Show more')}</a>
        </div>
      </div>
    );
  }
});

export default TodoList;
