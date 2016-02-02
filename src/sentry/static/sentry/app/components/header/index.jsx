import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import ConfigStore from '../../stores/configStore';
import OrganizationState from '../../mixins/organizationState';
import {Link} from 'react-router';

import Broadcasts from './broadcasts';
import StatusPage from './statuspage';
import UserNav from './userNav';
import OrganizationSelector from './organizationSelector';
import Todos from '../todos';

const Header = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  getInitialState: function() {
    if (location.hash == '#welcome') {
      return {showTodos: true};
    } else {
      return {showTodos: false};
    }
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
                { this.state.showTodos ? <div className="dropdown-menu"><Todos /></div> : null }
          </div>
        </div>
      </header>
    );
  }
});

export default Header;
