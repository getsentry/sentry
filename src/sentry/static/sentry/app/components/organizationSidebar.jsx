/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var AppState = require("../mixins/appState");
var ConfigStore = require("../stores/configStore");
var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");
var Gravatar = require("./gravatar");
var UserInfo = require("./userInfo");
var ListLink = require("./listLink");
var OrganizationState = require("../mixins/organizationState");
var PropTypes = require("../proptypes");
var PureRenderMixin = require("react/addons").addons.PureRenderMixin;
var TeamStore = require("../stores/teamStore");

var OrganizationSelector = React.createClass({
  mixins: [
    AppState,
    OrganizationState,
    PureRenderMixin
  ],

  render() {
    var activeOrg = this.getOrganization();
    var urlPrefix = ConfigStore.get('urlPrefix');
    var features = ConfigStore.get('features');

    return (
      <DropdownLink
          topLevelClasses="org-selector anchor-right"
          onOpen={this.onDropdownOpen}
          onClose={this.onDropdownClose}
          title={activeOrg.name}>
        {this.getOrganizationList().map((org) => {
          var iconStyle = {
            backgroundImage: 'url(https://github.com/getsentry.png)' //TODO(dcramer) use actual org avatar
          };
          return (
            <MenuItem key={org.slug} to="organizationDetails" params={{orgId: org.slug}} iconUrl="http://github.com/getsentry.png">
              <span className="org-avatar" style={iconStyle} />
              {org.name}
            </MenuItem>
          );
        })}
        {features.has('organizations:create') &&
          <div>
            <div className="divider"></div>
            <MenuItem href={urlPrefix + '/organizations/new/'}>New Organization</MenuItem>
          </div>
        }
      </DropdownLink>
    );
  }
});

var UserNav = React.createClass({
  mixins: [
    PureRenderMixin
  ],

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
          <UserInfo user={user} className="user-name" />
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
  mixins: [
    AppState,
    OrganizationState,
    Reflux.listenTo(TeamStore, "onTeamListChange")
  ],

  getInitialState() {
    return {
      teamList: []
    };
  },

  onTeamListChange() {
    var newTeamList = TeamStore.getActive();

    this.setState({
      teamList: newTeamList
    });
  },

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
            {this.state.teamList.map((team, teamIdx) => {
              var routeParams = {
                orgId: activeOrg.slug,
                teamId: team.slug
              };
              return (
                <div className="team" key={team.slug}>
                  <h6>
                    <Router.Link
                        to="teamDetails"
                        params={routeParams}>
                      {team.name}
                    </Router.Link>
                  </h6>
                  <ul className="project-list list-unstyled">
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
