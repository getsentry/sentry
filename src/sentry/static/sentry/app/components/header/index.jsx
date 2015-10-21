import React from "react";
import ConfigStore from "../../stores/configStore";
import OrganizationState from "../../mixins/organizationState";
import {Link} from "react-router";

import Broadcasts from "./broadcasts";
import UserNav from "./userNav";
import OrganizationSelector from "./organizationSelector";

const Header = React.createClass({
  mixins: [OrganizationState],

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
        </div>
      </header>
    );
  }
});

export default Header;
