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
            <ul className="user-nav">
              <li>
                <strong>
                  <a href="">
                    <span className="icon icon-book"></span>
                    Docs
                  </a>
                </strong>
              </li>
              <li>
                <div className="dropdown anchor-right">
                  <a href="#" className="dropdown-toggle">
                    <img src="" />
                    <span className="icon-arrow-down"></span>
                  </a>
                  <div className="dropdown-menu">
                    <ul className="user-account">
                      <li><strong><a href=""><span className="icon icon-settings"></span>Admin</a></strong></li>
                      <li><strong><a href=""><span className="icon icon-settings"></span>Account</a></strong></li>
                      <li><strong><a href=""><span className="icon icon-arrow-right"></span>Sign Out</a></strong></li>
                    </ul>
                  </div>
                </div>
              </li>
            </ul>
          </div>
          <Breadcrumbs />
         </div>
      </header>
    );
  }
});

module.exports = OrganizationHeader;
