import PropTypes from 'prop-types';
import React from 'react';

import {t} from '../../../locale';
import SentryTypes from '../../../proptypes';
import SettingsNavItem from './settingsNavItem';
import NavSection from './navSection.styled';
import SettingsHeading from './settingsHeading.styled';
import replaceRouterParams from '../../../utils/replaceRouterParams';
import PluginNavigation from '../../projectSettings/pluginNavigation';

/**
 * Navigation menu for integrations.
 *
 * Is composed of:
 *   - header
 *   - "All Integrations"
 *   - enabled plugins that have configurations
 */
class SettingsPluginsNavigation extends React.Component {
  static propTypes = {
    ...SentryTypes.NavigationGroup,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    access: PropTypes.object,
    features: PropTypes.object,
  };

  static contextTypes = {
    router: PropTypes.object,
    location: PropTypes.object,
  };

  render() {
    let {organization, project} = this.props;
    let {router} = this.context;

    const pathPrefix = '/settings/:orgId/:projectId';
    let allIntegrationsPath = replaceRouterParams(`${pathPrefix}/plugins/`, {
      orgId: organization && organization.slug,
      projectId: project && project.slug,
    });

    return (
      <NavSection>
        <SettingsHeading>{t('Integrations')}</SettingsHeading>

        <SettingsNavItem
          active={router.isActive(allIntegrationsPath)}
          to={allIntegrationsPath}
          label={t('All Integrations')}
        />

        <PluginNavigation>
          {plugin => {
            let to = replaceRouterParams(`${pathPrefix}/plugins/${plugin.slug}/`, {
              orgId: organization && organization.slug,
              projectId: project && project.slug,
            });
            return (
              <SettingsNavItem
                active={router.isActive(to)}
                key={plugin.id}
                to={to}
                label={plugin.name}
              />
            );
          }}
        </PluginNavigation>
      </NavSection>
    );
  }
}

export default SettingsPluginsNavigation;
