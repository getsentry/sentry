/*** @jsx React.DOM */

var React = require("react");

var AppState = require("../mixins/appState");
var ConfigStore = require("../stores/configStore");
var Gravatar = require("./gravatar");
var ListLink = require("./listLink");
var OrganizationState = require("../mixins/organizationState");
var PropTypes = require("../proptypes");

var OrganizationSelector = React.createClass({
  mixins: [AppState, OrganizationState],

  render() {
    var activeOrg = this.getOrganization();

    return (
      <div className="org-selector dropdown">
        <a href="" className="active-org">{activeOrg.name}</a>
        <a href="" className="dropdown-toggle">
          <span className="icon-arrow-down" />
        </a>
        <div className="dropdown-menu">
          <ul className="orgs">
            {this.getOrganizationList().map((org) => {
              return (
                <li key={org.slug}>
                  <a href="">{org.name}</a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
});

var UserNav = React.createClass({
  propTypes: {
    user: PropTypes.User.isRequired
  },

  render() {
    var user = this.props.user;
    var urlPrefix = ConfigStore.get('urlPrefix');

    return (
      <div className="user-nav">
        <Gravatar email={user.email} className="avatar" />
        <div className="user-details">
          <span className="user-name">{user.name || user.email}</span>
          <ul>
            <li><a href={urlPrefix + '/account/settings/'}>Account</a></li>
            <li><a href={urlPrefix + '/auth/logout/'}>Sign out</a></li>
          </ul>
        </div>
      </div>
    );
  }
});

var OrganizationSidebar = React.createClass({
  mixins: [AppState, OrganizationState],

  render() {
    var activeOrg = this.getOrganization();
    if (!activeOrg) {
      // TODO(dcramer): handle this case better
      return <div />;
    }

    var user = ConfigStore.get('user');

    return (
      <div className="app-sidebar">
        <OrganizationSelector />
        <div className="app-sidebar-content">
          <div className="teams">
            {activeOrg.teams.map((team, teamIdx) => {
              var routeParams = {
                orgId: activeOrg.slug,
                teamId: team.slug
              };
              return (
                <div className="team" key={team.slug}>
                  <h6>
                    <a className="pull-right" href="">
                      <span className="icon-settings" />
                    </a>
                    <Router.Link
                        to="teamDetails"
                        params={routeParams}>
                      {team.name}
                    </Router.Link>
                  </h6>
                  <ul className="project-list list-unstyled truncate">
                    {team.projects.map((project) => {
                      var routeParams = {
                        orgId: activeOrg.slug,
                        projectId: project.slug
                      };
                      return (
                        <ListLink
                            to="projectDetails"
                            params={routeParams}
                            key={project.slug}>
                          {project.name}
                        </ListLink>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
        {user &&
          <UserNav user={user} />
        }
      </div>
    );
  }
});

module.exports = OrganizationSidebar;
