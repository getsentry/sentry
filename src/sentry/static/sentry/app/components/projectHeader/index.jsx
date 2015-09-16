import React from "react";
import Router from "react-router";
import ConfigStore from "../../stores/configStore";

import ProjectSelector from "./projectSelector";

var ProjectHeader = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  render() {
    var routeParams = this.context.router.getCurrentParams();
    var navSection = this.props.activeSection;
    var urlPrefix = ConfigStore.get('urlPrefix');
    var project = this.props.project;
    var org = this.props.organization;
    var access = new Set(org.access);

    return (
      <div>
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
                {access.has('project:write') &&
                  <li className={navSection == 'settings' ? 'active': ''}>
                    <a href={urlPrefix + '/' + routeParams.orgId + '/' + routeParams.projectId + '/settings/'}>
                      Settings
                    </a>
                  </li>
                }
              </ul>
            </div>
            <ProjectSelector
                organization={org}
                projectId={project.slug}
                router={this.context.router} />
           </div>
        </div>
      </div>
    );
  }
});

export default ProjectHeader;
