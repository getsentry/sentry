import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import ProjectSelector from './projectSelector';
import BookmarkToggle from '../projects/bookmarkToggle';
import DropdownLink from '../dropdownLink';
import MenuItem from '../menuItem';

import {t} from '../../locale';

import {
  setActiveEnvironment,
  clearActiveEnvironment,
} from '../../actionCreators/environments';

class ProjectHeader extends React.Component {
  static propTypes = {
    project: PropTypes.object.isRequired,
    organization: PropTypes.object.isRequired,
    environments: PropTypes.array.isRequired,
    activeSection: PropTypes.string,
    activeEnvironment: PropTypes.object,
  };

  static defaultProps = {
    environments: [],
  };

  render() {
    let {project, environments, activeEnvironment} = this.props;
    let navSection = this.props.activeSection;
    let org = this.props.organization;
    let features = new Set(project.features);
    let access = new Set(org.access);
    let allEnvironmentsLabel = t('All environments');

    // TODO: remove when feature is released
    let hasEnvironmentsFeature = new Set(org.features).has('environments');

    let showEnvironmentsToggle = hasEnvironmentsFeature && navSection !== 'settings';

    let activeEnvironmentTitle = activeEnvironment
      ? activeEnvironment.name
      : allEnvironmentsLabel;

    return (
      <div className="sub-header flex flex-container flex-vertically-centered">
        <div className="project-header p-t-1">
          <div className="project-header-main">
            <div className="project-select-wrapper">
              <ProjectSelector organization={org} projectId={project.slug} />
              <BookmarkToggle />
            </div>

            <ul className="nav nav-tabs">
              <li className={navSection == 'stream' ? 'active' : ''}>
                <Link to={`/${org.slug}/${project.slug}/`}>{t('Issues')}</Link>
              </li>
              {features.has('global-events') && (
                <li className={navSection == 'events' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/events/`}>{t('Events')}</Link>
                </li>
              )}
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
                <Link to={`/${org.slug}/${project.slug}/releases/`}>{t('Releases')}</Link>
              </li>
              {access.has('project:write') && (
                <li className={navSection == 'settings' ? 'active' : ''}>
                  <Link to={`/${org.slug}/${project.slug}/settings/`}>
                    {t('Settings')}
                  </Link>
                </li>
              )}
            </ul>
          </div>
          {showEnvironmentsToggle && (
            <div className="project-header-toggle">
              <label>Environment</label>
              <DropdownLink
                anchorRight={true}
                title={activeEnvironmentTitle}
                className="environment-selector-toggle"
              >
                <MenuItem onClick={clearActiveEnvironment}>
                  {allEnvironmentsLabel}
                </MenuItem>
                {environments.map(env => (
                  <MenuItem key={env.id} onClick={() => setActiveEnvironment(env)}>
                    {env.name}
                  </MenuItem>
                ))}
              </DropdownLink>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ProjectHeader;
