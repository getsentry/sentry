import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import styled from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import ProjectLink from 'app/components/projectLink';
import ProjectSelector from 'app/components/projectHeader/projectSelector';
import BookmarkToggle from 'app/components/projects/bookmarkToggle';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import Button from 'app/components/button';
import NavTabs from 'app/components/navTabs';

import {t} from 'app/locale';

import {
  setActiveEnvironment,
  clearActiveEnvironment,
} from 'app/actionCreators/environments';

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
    const {project, environments, activeEnvironment} = this.props;
    const navSection = this.props.activeSection;
    const org = this.props.organization;
    const allEnvironmentsLabel = t('All environments');

    const pagesWithEnvironments = new Set([
      'stream',
      'releases',
      'dashboard',
      'events',
      'user-feedback',
    ]);
    const showEnvironmentsToggle = pagesWithEnvironments.has(navSection);

    const activeEnvironmentTitle = activeEnvironment
      ? activeEnvironment.displayName
      : allEnvironmentsLabel;

    return (
      <div className="sub-header flex flex-container flex-vertically-centered">
        <div className="project-header">
          <div className="project-header-main">
            <div className="project-select-wrapper">
              <ProjectSelector organization={org} projectId={project.slug} />
              <BookmarkToggle />
            </div>

            <NavTabs>
              <li className={navSection == 'stream' ? 'active' : ''}>
                <ProjectLink to={`/${org.slug}/${project.slug}/`}>
                  {t('Issues')}
                </ProjectLink>
              </li>
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
              <li className={navSection == 'settings' ? 'active' : ''}>
                <Link to={`/settings/${org.slug}/projects/${project.slug}/`}>
                  {t('Settings')}
                </Link>
              </li>
            </NavTabs>
          </div>
          {showEnvironmentsToggle && (
            <EnvironmentsToggle>
              <div className="project-header-toggle">
                <label>{t('Environment')}</label>
                <DropdownLink
                  anchorRight={true}
                  title={activeEnvironmentTitle}
                  className="environment-selector-toggle"
                >
                  <MenuItem
                    onClick={clearActiveEnvironment}
                    className={activeEnvironment === null && 'active'}
                    linkClassName="truncate"
                  >
                    {allEnvironmentsLabel}
                  </MenuItem>
                  {environments.map(env => (
                    <MenuItem
                      key={env.id}
                      onClick={() => setActiveEnvironment(env)}
                      className={
                        activeEnvironment &&
                        activeEnvironment.name === env.name &&
                        'active'
                      }
                      linkClassName="truncate"
                    >
                      {env.displayName}
                    </MenuItem>
                  ))}
                  <MenuItem divider={true} />
                  <div style={{textAlign: 'center', padding: '5px 0px'}}>
                    <Button
                      to={`/settings/${org.slug}/projects/${project.slug}/environments/`}
                      size="small"
                    >
                      {t('Manage environments')}
                    </Button>
                  </div>
                </DropdownLink>
              </div>
            </EnvironmentsToggle>
          )}
        </div>
      </div>
    );
  }
}

const EnvironmentsToggle = styled('div')`
  display: flex;
  position: relative;
`;

export default ProjectHeader;
