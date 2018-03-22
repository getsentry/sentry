import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import SentryTypes from '../../proptypes';
import ProjectLink from '../../components/projectLink';
import ProjectSelector from './projectSelector';
import BookmarkToggle from '../projects/bookmarkToggle';
import DropdownLink from '../dropdownLink';
import MenuItem from '../menuItem';
import Button from '../buttons/button';

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
    activeEnvironment: SentryTypes.Environment,
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
    let orgFeatures = new Set(org.features);
    let allEnvironmentsLabel = t('All environments');

    // TODO: remove when feature is released
    let hasEnvironmentsFeature = orgFeatures.has('environments');
    let pagesWithEnvironments = new Set([
      'stream',
      'releases',
      'dashboard',
      'events',
      'user-feedback',
    ]);
    let pageHasEnvironments = pagesWithEnvironments.has(navSection);
    let showEnvironmentsToggle = hasEnvironmentsFeature && pageHasEnvironments;

    let activeEnvironmentTitle = activeEnvironment
      ? activeEnvironment.displayName
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
                <ProjectLink to={`/${org.slug}/${project.slug}/`}>
                  {t('Issues')}
                </ProjectLink>
              </li>
              {features.has('global-events') && (
                <li className={navSection == 'events' ? 'active' : ''}>
                  <ProjectLink to={`/${org.slug}/${project.slug}/events/`}>
                    {t('Events')}
                  </ProjectLink>
                </li>
              )}
              <li className={navSection == 'dashboard' ? 'active' : ''}>
                <ProjectLink to={`/${org.slug}/${project.slug}/dashboard/`}>
                  {t('Overview')}
                </ProjectLink>
              </li>
              <li className={navSection == 'user-feedback' ? 'active' : ''}>
                <ProjectLink to={`/${org.slug}/${project.slug}/user-feedback/`}>
                  {t('User Feedback')}
                </ProjectLink>
              </li>
              <li className={navSection == 'releases' ? 'active' : ''}>
                <ProjectLink to={`/${org.slug}/${project.slug}/releases/`}>
                  {t('Releases')}
                </ProjectLink>
              </li>
              {access.has('project:write') && (
                <li className={navSection == 'settings' ? 'active' : ''}>
                  <Link
                    to={
                      orgFeatures.has('new-settings')
                        ? `/settings/${org.slug}/${project.slug}/`
                        : `/${org.slug}/${project.slug}/settings/`
                    }
                  >
                    {t('Settings')}
                  </Link>
                </li>
              )}
            </ul>
          </div>
          {showEnvironmentsToggle && (
            <div className="project-header-toggle">
              <label>{t('Environment')}</label>
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
                    {env.displayName}
                  </MenuItem>
                ))}
                <MenuItem divider={true} />
                <div style={{textAlign: 'center', padding: '5px 0px'}}>
                  <Button
                    to={
                      orgFeatures.has('new-settings')
                        ? `/settings/${org.slug}/${project.slug}/environments/`
                        : `/${org.slug}/${project.slug}/settings/`
                    }
                    priority="primary"
                    size="small"
                  >
                    {t('Manage environments')}
                  </Button>
                </div>
              </DropdownLink>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ProjectHeader;
