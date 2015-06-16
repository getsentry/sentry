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

module.exports = OrganizationHomeContainer;
