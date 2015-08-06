import React from "react";
import OrganizationHeader from "./organizationHeader";
import OrganizationHomeSidebar from "./organizationHomeSidebar";
import OrganizationState from "../mixins/organizationState";
import Loading from "../components/loadingIndicator";

var OrganizationHomeContainer = React.createClass({
  mixins: [OrganizationState],

  render() {
    return (
      <div className="organization-home">
        <OrganizationHeader />
        <div className="container">
          <div className="content row">
            <div className="col-md-2">
              <OrganizationHomeSidebar />
            </div>
            <div className="col-md-10">
              {this.props.children}
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default OrganizationHomeContainer;

