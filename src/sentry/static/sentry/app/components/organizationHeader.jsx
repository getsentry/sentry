/*** @jsx React.DOM */

var React = require("react");

var AppState = require("../mixins/appState");
var Breadcrumbs = require("./breadcrumbs");
var OrganizationState = require("../mixins/organizationState");

var OrganizationHeader = React.createClass({
  mixins: [AppState, OrganizationState],

  render() {
    return (
      <div>
        <header>
          <div className="container">Sup</div>
        </header>
        <div className="sub-header">
          <div className="container">
            <Breadcrumbs />
           </div>
        </div>
      </div>
    );
  }
});

module.exports = OrganizationHeader;
