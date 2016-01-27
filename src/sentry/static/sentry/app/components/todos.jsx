import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import ConfigStore from '../stores/configStore';
import OrganizationState from '../mixins/organizationState';

const TASKS = [
  {
    'task': 1,
    'title': 'Send your first event',
    'description': 'Install Sentry\'s client to get started error logging',
    'skippable': false,
    'feature_location': 'project',
    'location': 'settings/install/'
  },
  {
    'task': 2,
    'title': 'Invite team member',
    'description': 'Bring your team aboard',
    'skippable': false,
    'feature_location': 'organization',
    'location': 'members/new/',
  },
  {
    'task': 8,
    'title': 'Set up release tracking',
    'description': 'See what releases are generating errors.',
    'skippable': false,
    'feature_location': 'project',
    'location': 'settings/release-tracking/',
  },
  {
    'task': 3,
    'title': 'Set up issue tracking',
    'description': 'Integrate Sentry into your team\'s issue tracker',
    'skippable': true,
    'feature_location': 'project',
    'location': 'settings/issue-tracking/',
  },
  {
    'task': 4,
    'title': 'Set up a notification service',
    'description': 'Receive Sentry alerts in Slack or HipChat',
    'skippable': true,
    'feature_location': 'project',
    'location': 'settings/notifications/',
  },
  {
    'task': 5,
    'title': 'Add a second platform',
    'description': 'Add Sentry to a second platform',
    'skippable': false,
    'feature_location': 'organization',
    'location': 'projects/new/',
  },
  {
    'task': 6,
    'title': 'Add user context to errors',
    'description': 'Know what users are being affected by errors and crashes',
    'skippable': false,
    'feature_location': 'absolute',
    'location': 'https://docs.getsentry.com/hosted/learn/context/#capturing-the-user',
  },
  // {
  //   'task': 7,
  //   'title': 'Deminify javascript with sourcemaps',
  //   'description': 'Upload sourcemaps',
  //   'skippable': false,
  //   'feature_location': 'absolute',
  //   'location': 'https://docs.getsentry.com/hosted/clients/javascript/sourcemaps/'
  // },
  // {
  //   'task': 9,
  //   'title': 'User crash reports',
  //   'description': 'Collect user feedback when your application crashes',
  //   'skippable': false,
  //   'feature_location': 'project',
  //   'location': 'settings/user-reports/'
  // },
]

const TodoItem = React.createClass({
  mixins: [OrganizationState],

  propTypes: {
    task: React.PropTypes.object,
  },

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

    if (this.props.task['status'] == 'Complete') {
      classNames += ' checked';
    } else if (this.props.task['status'] == 'Pending') {
      classNames += ' pending';
    } else if (this.props.task['status'] == 'Skipped') {
      classNames += ' skipped';
    }

    if (this.state.showConfirmation) {
      classNames += ' blur';
    }

    var learn_more_url= '';
    if (this.props.task['feature_location'] === 'project') {
      learn_more_url = '/organizations/' + org.slug + '/projects/choose/?next=' + this.props.task['location'];
    } else if (this.props.task['feature_location'] === 'organization') {
      learn_more_url = '/organizations/' + org.slug + '/' + this.props.task['location'];
    } else if (this.props.task['feature_location'] === 'absolute') {
      learn_more_url = this.props.task['location'];
    }

    return (
      <li className={classNames}>
        <div className="todo-content">
          <div className="ob-checkbox">
            { this.props.task['status'] == 'Complete' ? <span className="icon-checkmark" /> : null }
          </div>
          <h4>{ this.props.task['title'] }</h4>
          <p>
            { this.props.task['description'] } &middot; <span><a href={learn_more_url}>Learn more</a></span>
          </p>
          { this.props.task['skippable'] && this.props.task['status'] != 'Skipped' && this.props.task['status'] != 'Complete' && !this.state.showConfirmation ? <a className="skip-btn btn btn-default" onClick={this.toggleConfirmation}>Skip</a> : null }
        </div>
        { this.state.showConfirmation ? <Confirmation task={this.props.task['task']} onSkip={this.skip} dismiss={this.toggleConfirmation} /> : null }
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
        <h3>Need help?</h3>
        <p><a href="mailto:eric@getsentry.com?subject=:P">Ask us!</a> &middot; <a onClick={this.skip}>Skip</a></p>
      </div>
    );
  }
});

const Todos = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  getInitialState: function() {
    return {tasks: []};
  },

  componentWillMount() {
    let org = this.getOrganization();
    let tasks = [];
    for (var task of TASKS) {
      task['status'] = '';
      for (var server_task of org.onboardingTasks) {
        if (server_task['task'] == task['task']) {
          task['status'] = server_task['status'];
          break;
        }
      }
      tasks.push(task);
    }
    this.setState({tasks: tasks})
  },

  skipTask: function(skipped_task) {
    let org = this.getOrganization();
    this.api.request('/organizations/' + org.slug + '/onboarding-tasks/', {
      method: 'POST',
      data: {'task': skipped_task, 'status': 'Skipped'},
      success: () => {
        let new_state = this.state.tasks.map( (task) => {
          if (task['task'] == skipped_task) { task['status'] = 'Skipped' };
          return task;
        });
        this.setState({tasks: new_state});
      },
      error: () => {
        console.log('Unable to skip this task');
      }
    });
    this.getOnboardingTasks();
  },

  render: function() {
    let todo_list = this.state.tasks.map(function(task) {
      return (<TodoItem key={task['task']} task={task} onSkip={this.skipTask} />)
    }, this);

    return (
        <div className="onboarding-wrapper">
          <h3>Getting Started with Sentry</h3>
          <ul className="list-unstyled">
            {todo_list}
          </ul>
        </div>
    );
  }
});

export default Todos;
