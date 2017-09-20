import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import DropdownLink from '../dropdownLink';
import MenuItem from '../menuItem';
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
          <div className="project-options">
            <div>
              <ProjectSelector organization={org} projectId={project.slug} />
            </div>
            <div>
              <BookmarkToggle orgId={org.slug} project={project}>
                <a className="bookmark-toggle">
                  <span
                    className={
                      project.isBookmarked
                        ? 'icon icon-star-solid active'
                        : 'icon icon-star-outline'
                    }
                  />
                </a>
              </BookmarkToggle>
            </div>
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

        <div className="align-right project-filters">
          <div className="project-filter">
            <div className="project-filter-label">{t('Notifications')}</div>
            <DropdownLink caret={true} title={t('Unsubscribed')} anchorRight={true}>
              <MenuItem header={true}>Issues that have occurred in...</MenuItem>
              <MenuItem>
                The past 24 hours
              </MenuItem>
              <MenuItem>
                The past 7 days
              </MenuItem>
              <MenuItem>
                The past two weeks
              </MenuItem>
              <MenuItem>
                The past month
              </MenuItem>
            </DropdownLink>
          </div>
          <div className="project-filter">
            <div className="project-filter-label">{t('Date range')}</div>
            <DropdownLink caret={true} title={t('The past 48 hours')} anchorRight={true}>
              <MenuItem header={true}>Issues that have occurred in...</MenuItem>
              <MenuItem>
                The past 24 hours
              </MenuItem>
              <MenuItem>
                The past 7 days
              </MenuItem>
              <MenuItem>
                The past two weeks
              </MenuItem>
              <MenuItem>
                The past month
              </MenuItem>
            </DropdownLink>
          </div>
          <div className="project-filter">
            <div className="project-filter-label">{t('Environment')}</div>
            <DropdownLink caret={true} title={t('Production')} anchorRight={true}>
              <MenuItem>
                Production
              </MenuItem>
              <MenuItem>
                Staging
              </MenuItem>
            </DropdownLink>
          </div>
        </div>
      </div>
    );
  }
});

export default ProjectHeader;
