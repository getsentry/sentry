import React from "react";
import {Link} from "react-router";
import ConfigStore from "../../stores/configStore";

import ProjectSelector from "./projectSelector";

var ProjectHeader = React.createClass({
  render() {
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
                <li className={navSection == 'dashboard' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/dashboard/`}>
                    Dashboard
                  </Link>
                </li>
                <li className={navSection == 'stream' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/`}>
                    Issues
                  </Link>
                </li>
                <li className={navSection == 'releases' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/releases/`}>
                    Releases
                  </Link>
                </li>
                {access.has('project:write') &&
                  <li className={navSection == 'settings' ? 'active' : ''}>
                    <a href={urlPrefix + `/${org.slug}/${project.slug}/settings/`}>
                      Settings
                    </a>
                  </li>
                }
              </ul>
            </div>
            <ProjectSelector
                organization={org}
                projectId={project.slug}/>
           </div>
        </div>
      </div>
    );
  }
});

export default ProjectHeader;
