/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var Breadcrumbs = require("./breadcrumbs");
var ConfigStore = require("../stores/configStore");
var DropdownLink = require("./dropdownLink");
var Gravatar = require("./gravatar");
var MenuItem = require("./menuItem");
var PropTypes = require("../proptypes");
var UserInfo = require("./userInfo");

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


var UserNav = React.createClass({
  propTypes: {
    user: PropTypes.User.isRequired
  },

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.user.id !== this.props.user.id;
  },

  render() {
    var user = this.props.user;
    var urlPrefix = ConfigStore.get('urlPrefix');

    var title = (
      <span>
        <Gravatar email={user.email} className="avatar" />
        <UserInfo user={user} className="user-name" />
      </span>
    );

    return (
      <DropdownLink
          topLevelClasses={this.props.className}
          menuClasses="dropdown-menu-right"
          title={title}>
        <MenuItem href={urlPrefix + '/account/settings/'}>Account</MenuItem>
        <MenuItem href={urlPrefix + '/auth/logout/'}>Sign out</MenuItem>
      </DropdownLink>
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
    var user = ConfigStore.get('user');

    return (
      <div>
        <header>
          <div className="container">
            {user &&
              <UserNav user={user} className="pull-right" />
            }
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
