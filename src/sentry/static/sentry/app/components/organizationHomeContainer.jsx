/*** @jsx React.DOM */

var React = require("react");

var OrganizationHeader = require("./organizationHeader");
var OrganizationHomeSidebar = require("./organizationHomeSidebar");
var OrganizationState = require("../mixins/organizationState");

var Loading = require("../components/loadingIndicator");

var OrganizationHomeContainer = React.createClass({
  mixins: [OrganizationState],

  render() {
    return (
      <div>
        <OrganizationHeader />
        <div className="container">
          <div className="content">
            <OrganizationHomeSidebar />
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = OrganizationHomeContainer;
