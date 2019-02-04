import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import SettingsNavItem from 'app/views/settings/components/settingsNavItem';
import NavSection from 'app/views/settings/components/navSection.styled';
import SettingsHeading from 'app/views/settings/components/settingsHeading.styled';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import PluginNavigation from 'app/views/projectSettings/pluginNavigation';

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
    const {organization, project} = this.props;
    const {router} = this.context;

    const pathPrefix = '/settings/:orgId/projects/:projectId';
    const allIntegrationsPath = replaceRouterParams(`${pathPrefix}/plugins/`, {
      orgId: organization && organization.slug,
      projectId: project && project.slug,
    });

    return (
      <NavSection>
        <SettingsHeading>{t('Legacy Integrations')}</SettingsHeading>

        <SettingsNavItem
          active={router.isActive(allIntegrationsPath)}
          to={allIntegrationsPath}
          label={t('Legacy Integrations')}
        />

        <PluginNavigation>
          {plugin => {
            const to = replaceRouterParams(`${pathPrefix}/plugins/${plugin.slug}/`, {
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
