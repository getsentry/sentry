/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var Breadcrumbs = require("./breadcrumbs");
var ConfigStore = require("../stores/configStore");

var DateRangePicker = React.createClass({
  render() {
    return (
      <div className="dropdown anchor-right range-picker">
        <a href="#" className="dropdown-toggle">
          Last 7 days
          <span className="icon-arrow-down"></span>
        </a>
      </div>
    );
  }
});

var OrganizationHeader = React.createClass({
  mixins: [Router.State],

  render() {
    var routeParams = this.getParams();
    var navSection = this.props.activeSection;
    var urlPrefix = ConfigStore.get('urlPrefix');

    return (
      <header>
        <div className="container">
          <div className="pull-right">
            <ul className="nav nav-tabs nav-tabs-mini">
              <li className={navSection == 'stream' ? 'active': ''}>
                <Router.Link to="stream" params={routeParams}>
                  Stream
                </Router.Link>
              </li>
              <li className={navSection == 'settings' ? 'active': ''}>
                <a href={urlPrefix + '/' + routeParams.orgId + '/' + routeParams.projectId + '/settings/'}>
                  Settings
                </a>
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
