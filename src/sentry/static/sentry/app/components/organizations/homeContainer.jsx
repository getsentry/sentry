import React from "react";
import OrganizationHomeSidebar from "./homeSidebar";
import OrganizationState from "../../mixins/organizationState";

var HomeContainer = React.createClass({
  mixins: [OrganizationState],

  render() {
    return (
      <div className="organization-home">
        <div className="container">
          <div className="content row">
            <div className="col-md-2 org-sidebar">
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

export default HomeContainer;
