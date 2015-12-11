import React from 'react';
import {Link} from 'react-router';
import ConfigStore from '../../stores/configStore';

import ProjectSelector from './projectSelector';
import {t} from '../../locale';

const ProjectHeader = React.createClass({
  render() {
    let navSection = this.props.activeSection;
    let urlPrefix = ConfigStore.get('urlPrefix');
    let project = this.props.project;
    let org = this.props.organization;
    let features = new Set(org.features);
    let access = new Set(org.access);

    return (
      <div>
        <div className="sub-header">
          <div className="container">
            <div className="pull-right">
              <ul className="nav nav-tabs">
                <li className={navSection == 'dashboard' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/dashboard/`}>
                    {t('Dashboard')}
                  </Link>
                </li>
                <li className={navSection == 'stream' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/`}>
                    {t('Issues')}
                  </Link>
                </li>
                {features.has('events') &&
                  <li className={navSection == 'events' ? 'active' : ''}>
                    <Link to={`/${org.slug}/${project.slug}/events/`}>
                      {t('Events')}
                    </Link>
                  </li>
                }
                <li className={navSection == 'releases' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/releases/`}>
                    {t('Releases')}
                  </Link>
                </li>
                {access.has('project:write') &&
                  <li className={navSection == 'settings' ? 'active' : ''}>
                    <a href={urlPrefix + `/${org.slug}/${project.slug}/settings/`}>
                      {t('Settings')}
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
