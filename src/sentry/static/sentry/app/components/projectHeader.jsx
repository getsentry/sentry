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

var ProjectHeader = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  render() {
    var routeParams = this.context.router.getCurrentParams();
    var navSection = this.props.activeSection;
    var urlPrefix = ConfigStore.get('urlPrefix');

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
            <div className="pull-right">
              <ul className="nav nav-tabs">
                <li className={navSection == 'dashboard' ? 'active': ''}>
                  <Router.Link to="projectDashboard" params={routeParams}>
                    Dashboard
                  </Router.Link>
                </li>
                <li className={navSection == 'stream' ? 'active': ''}>
                  <Router.Link to="stream" params={routeParams}>
                    Stream
                  </Router.Link>
                </li>
                <li className={navSection == 'releases' ? 'active': ''}>
                  <Router.Link to="projectReleases" params={routeParams}>
                    Releases
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
        </div>
      </div>
    );
  }
});

module.exports = ProjectHeader;
