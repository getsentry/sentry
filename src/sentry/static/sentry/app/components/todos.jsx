import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import ConfigStore from '../stores/configStore';
import OrganizationState from '../mixins/organizationState';

const Todos = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  skip: function() {
    let org = this.getOrganization();
    this.api.request('/organizations/' + org.slug + '/onboarding-tasks/', {
      method: 'POST',
      data: {'a': 1}
    });
    this.getOnboardingTasks();
  },

  render: function() {
    return (
        <div className="onboarding-wrapper">
          <h3>Remaining Todos</h3>
          <ul className="list-unstyled">
            <TodoItem completed={true} />
            <TodoItem skippable={true} />
            <TodoItem />
          </ul>
        </div>
    );
  }
});

const TodoItem = React.createClass({
  propTypes: {
    completed: React.PropTypes.bool,
    skippable: React.PropTypes.bool
  },

  getDefaultProps: function() {
    return {
      completed: false,
      skippable: false
    };
  },

  getInitialState: function() {
    return {
      showTodos: false
    };
  },

  render: function() {

    let classNames = '';

    if (this.props.completed) {
      classNames += ' checked';
    }

    return (
      <li className={classNames}>
        <div className="ob-checkbox">
          { this.props.completed ? <span className="icon-checkmark" /> : null }
        </div>
        <h4>Setup notification services</h4>
        <p>
          Be notified of Issues via Slack, HipChat, and More &middot; <a href="#">Learn More</a>
        </p>
        { this.props.skippable ? <a className="skip-btn btn btn-default">Skip</a> : null }
      </li>
    );
  }
});

export default Todos;
