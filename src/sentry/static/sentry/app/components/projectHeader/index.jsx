import React from 'react';
import {Link} from 'react-router';


import ProjectSelector from './projectSelector';
import BookmarkToggle from '../projects/bookmarkToggle';

import {t} from '../../locale';

const ProjectHeader = React.createClass({
  propTypes: {
    project: React.PropTypes.object.isRequired,
    organization: React.PropTypes.object.isRequired,
    activeSection: React.PropTypes.string
  },

  render() {
    let navSection = this.props.activeSection;
    let project = this.props.project;
    let org = this.props.organization;
    let features = new Set(project.features);
    let access = new Set(org.access);

    return (
      <div>
        <div className="sub-header">
          <div className="container">
            <ProjectSelector
                organization={org}
                projectId={project.slug}/>

            <div className="pull-right project-actions">
              <BookmarkToggle orgId={org.slug} project={project}>
                <a className="">
                  <span className={project.isBookmarked ? 'icon icon-star-solid active' : 'icon icon-star-solid'}/>
                  {t('Star')}
                </a>
                {access.has('project:write') &&
                  <a className={navSection == 'settings' ? 'active' : ''} href={`/${org.slug}/${project.slug}/settings/`}>
                    <span className="icon icon-settings" /> {t('Settings')}
                  </a>
                }
              </BookmarkToggle>
            </div>

            <ul className="nav nav-tabs">
              <li className={navSection == 'stream' ? 'active' : ''}>
                <Link to={`/${org.slug}/${project.slug}/`}>
                  {t('Issues')}
                </Link>
              </li>
              {features.has('global-events') &&
                <li className={navSection == 'events' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/events/`}>
                    {t('Events')}
                  </Link>
                </li>
              }
              <li className={navSection == 'dashboard' ? 'active' : ''}>
                <Link to={`/${org.slug}/${project.slug}/dashboard/`}>
                  {t('Overview')}
                </Link>
              </li>
              <li className={navSection == 'user-feedback' ? 'active' : ''}>
                <Link to={`/${org.slug}/${project.slug}/user-feedback/`}>
                  {t('User Feedback')}
                </Link>
              </li>
              <li className={navSection == 'releases' ? 'active' : ''}>
                <Link to={`/${org.slug}/${project.slug}/releases/`}>
                  {t('Releases')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
});

export default ProjectHeader;
