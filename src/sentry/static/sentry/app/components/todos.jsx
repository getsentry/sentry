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
            <li className="checked">
              <div className="ob-checkbox">
                <span className="icon-checkmark"/>
              </div>
              <h4>Send your first event</h4>
              <p>
                View our <a href="#">installation instructions</a>
              </p>
            </li>
            <li>
              <div className="ob-checkbox"></div>
              <h4>Invite team members</h4>
              <p>
                Learn about <a href="#">how access works</a> on Sentry
              </p>
            </li>
            <li>
              <div className="ob-checkbox"></div>
              <h4>Teach Sentry about your project</h4>
              <p>
                Track users, releases, and other rich context &middot; <a href="#">Learn More</a>
              </p>
            </li>
            <li>
              <div className="ob-checkbox"></div>
              <h4>Add an issue tracker</h4>
              <p>
                Link Sentry Issues in Jira, GitHub, Trello, and others &middot; <a href="#">Learn More</a>
              </p>
              <a href="#" className="skip-btn btn btn-default">Skip</a>
            </li>
            <li>
              <div className="ob-checkbox"></div>
              <h4>Setup notification services</h4>
              <p>
                Be notified of Issues via Slack, HipChat, and More &middot; <a href="#">Learn More</a>
              </p>
              <a href="#" className="skip-btn btn btn-default">Skip</a>
            </li>
          </ul>
        </div>
    );
  }
});

export default Todos
