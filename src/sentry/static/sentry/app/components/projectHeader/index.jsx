import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import ProjectSelector from './projectSelector';
import BookmarkToggle from '../projects/bookmarkToggle';

import {t} from '../../locale';

const ProjectHeader = React.createClass({
  propTypes: {
    project: PropTypes.object.isRequired,
    organization: PropTypes.object.isRequired,
    activeSection: PropTypes.string
  },

  render() {
    let navSection = this.props.activeSection;
    let project = this.props.project;
    let org = this.props.organization;
    let features = new Set(project.features);
    let access = new Set(org.access);

    return (
      <div className="sub-header flex flex-container flex-vertically-centered">
        <div className="p-t-1">
          <ProjectSelector organization={org} projectId={project.slug} />

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
              </li>}
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
            {access.has('project:write') &&
              <li className={navSection == 'settings' ? 'active' : ''}>
                <a href={`/${org.slug}/${project.slug}/settings/`}>
                  {t('Settings')}
                </a>
              </li>}
          </ul>
        </div>

        <div className="align-right project-actions">
          <BookmarkToggle orgId={org.slug} project={project}>
            <a className="btn btn-sm btn-default">
              <span
                className={
                  project.isBookmarked
                    ? 'icon icon-star-solid active'
                    : 'icon icon-star-solid'
                }
              />
              {project.isBookmarked
                ? <span>{t('Unstar Project')}</span>
                : <span>{t('Star Project')}</span>}
            </a>
          </BookmarkToggle>
        </div>
      </div>
    );
  }
});

export default ProjectHeader;
