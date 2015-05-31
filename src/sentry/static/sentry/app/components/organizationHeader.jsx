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
          <div className="container">
            <div className="pull-right">
              <div className="dropdown user-nav">
                <a className="dropdown-toggle" href="#">Dcramer <span className="icon-arrow-down"></span></a>
              </div>
            </div>
            <a href="/"><span className="icon-sentry-logo"></span></a>
            <div className="dropdown org-selector">
              <a className="dropdown-toggle" href="#">Sentry <span className="icon-arrow-down"></span></a>
              <ul className="dropdown-menu">
                <li><a href="#">Default</a></li>
                <li><a href="#">Sentry</a></li>
                <li className="divider"></li>
                <li><a href="#">New Organization</a></li>
              </ul>
            </div>
          </div>
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
