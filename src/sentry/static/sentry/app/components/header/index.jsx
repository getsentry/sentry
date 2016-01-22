import React from 'react';
import ConfigStore from '../../stores/configStore';
import OrganizationState from '../../mixins/organizationState';
import {Link} from 'react-router';

import Broadcasts from './broadcasts';
import StatusPage from './statuspage';
import UserNav from './userNav';
import OrganizationSelector from './organizationSelector';

const Header = React.createClass({
  mixins: [OrganizationState],

  getInitialState: function() {
    return {showTodos: false};
  },

  toggleTodos() {
    this.setState({showTodos: !this.state.showTodos});
  },

  render() {
    let user = ConfigStore.get('user');
    let logo;

    if (user) {
      logo = <span className="icon-sentry-logo"/>;
    } else {
      logo = <span className="icon-sentry-logo-full"/>;
    }

    // NOTE: this.props.orgId not guaranteed to be specified
    return (
      <header>
        <div className="container">
          <UserNav className="pull-right" />
          <Broadcasts className="pull-right" />
          {this.props.orgId ?
            <Link to={`/${this.props.orgId}/`} className="logo">{logo}</Link>
            :
            <a href="/" className="logo">{logo}</a>
          }
          <OrganizationSelector organization={this.getOrganization()} className="pull-right" />

          <StatusPage className="pull-right" />
          <div className="onboarding-progress-bar" onClick={this.toggleTodos}>
            <div className="slider"></div>
             { this.state.showTodos ? <Todos /> : null }
          </div>
        </div>
      </header>
    );
  }
});

const Todos = React.createClass({
  render: function() {
    return (
      <div className="dropdown-menu">
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
                Track users, releases, and other rich context  &middot; <a href="#">Learn More</a>
              </p>
            </li>
            <li>
              <div className="ob-checkbox"></div>
              <h4>Add an issue tracker</h4>
              <p>
                Link Sentry Issues in Jira, GitHub, Trello, and others &middot; <a href="#">Learn More</a>
              </p>
            </li>
            <li>
              <div className="ob-checkbox"></div>
              <h4>Setup notification services</h4>
              <p>
                Be notified of Issues via Slack, HipChat, and More &middot; <a href="#">Learn More</a>
              </p>
            </li>
          </ul>
        </div>
      </div>
    );
  }
});

export default Header;
