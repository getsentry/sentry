/*** @jsx React.DOM */

var React = require("react");

var AppState = require("../mixins/appState");
var ListLink = require("./listLink");
var OrganizationState = require("../mixins/organizationState");

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

  render() {
    return (
      <div className="user-nav dropdown">
        <img src="https://github.com/dcramer.png" className="avatar" />
        <div className="user-details">
          <span className="user-name">David Cramer</span>
          <ul>
            <li><a href="#">Docs</a></li>
            <li><a href="#">Account</a></li>
            <li><a href="#">Sign out</a></li>
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

    return (
      <div>
        <OrganizationSelector />
        <div className="app-sidebar">
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
        <UserNav />
      </div>
    );
  }
});

module.exports = OrganizationSidebar;
