import React from "react";
import ConfigStore from "../../stores/configStore";
import OrganizationState from "../../mixins/organizationState";
import {Link} from "react-router";

import UserNav from "./userNav";
import OrganizationSelector from "./organizationSelector";

var Header = React.createClass({
  mixins: [OrganizationState],

  render() {
    var user = ConfigStore.get('user');
    var logo;

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
          <ul className="global-nav pull-right">
            <li><a href="https://docs.getsentry.com">Docs</a></li>
          </ul>
          {this.props.orgId ?
            <Link to={`/${this.props.orgId}/`}className="logo">{logo}</Link>
            :
            <a href="/" className="logo">{logo}</a>
          }
          <OrganizationSelector organization={this.getOrganization()} className="pull-right" />
        </div>
      </header>
    );
  }
});

export default Header;
