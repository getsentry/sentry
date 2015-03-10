/*** @jsx React.DOM */

var React = require("react");

var AppState = require("../mixins/appState");
var Breadcrumbs = require("./breadcrumbs");
var OrganizationState = require("../mixins/organizationState");

var OrganizationHeader = React.createClass({
  mixins: [AppState, OrganizationState],

  render() {
    return (
      <header>
        <div className="container">
          <div className="pull-right">
            <div className="dropdown anchor-right range-picker">
              <a href="#" className="dropdown-toggle">
                Last 7 days
                <span className="icon-arrow-down"></span>
              </a>
              <div className="dropdown-menu">
                <ul>
                  <li><strong><a href=""><span className="icon icon-settings"></span>Admin</a></strong></li>
                  <li><strong><a href=""><span className="icon icon-settings"></span>Account</a></strong></li>
                  <li><strong><a href=""><span className="icon icon-arrow-right"></span>Sign Out</a></strong></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pull-right">
            <ul className="nav nav-tabs nav-tabs-mini">
              <li className="active"><a href="#">Stream</a></li>
              <li><a href="#">Releases</a></li>
              <li><a href="#">Explore</a></li>
              <li><a href="#">Settings</a></li>
            </ul>
          </div>
          <Breadcrumbs />
         </div>
      </header>
    );
  }
});

module.exports = OrganizationHeader;
