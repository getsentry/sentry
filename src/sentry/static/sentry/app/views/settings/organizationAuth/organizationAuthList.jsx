import PropTypes from 'prop-types';
import React from 'react';

import {CSRF_COOKIE_NAME} from 'app/constants';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {descopeFeatureName} from 'app/utils';
import {t, tct} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/externalLink';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import getCookie from 'app/utils/getCookie';

import ProviderItem from './providerItem';

class OrganizationAuthList extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  static propTypes = {
    providerList: PropTypes.arrayOf(SentryTypes.AuthProvider).isRequired,
    activeProvider: PropTypes.object,
  };

  render() {
    const {activeProvider} = this.props;
    const {organization} = this.context;
    const features = organization.features;

    // Sort feature-flagged integrations last
    const providerList = (this.props.providerList || []).sort((a, b) => {
      const aEnabled = features.includes(descopeFeatureName(a.requiredFeature));
      const bEnabled = features.includes(descopeFeatureName(b.requiredFeature));

      if (aEnabled !== bEnabled) {
        return aEnabled ? -1 : 1;
      }

      return a.requiredFeature.localeCompare(b.requiredFeature);
    });

    const warn2FADisable =
      organization.require2FA &&
      providerList.some(({requiredFeature}) =>
        features.includes(descopeFeatureName(requiredFeature))
      );

    return (
      <div className="sso">
        <SettingsPageHeader title="Authentication" />
        <PermissionAlert />
        <Panel>
          <PanelHeader>{t('Choose a provider')}</PanelHeader>
          <PanelBody>
            {!activeProvider && (
              <PanelAlert type="info">
                {tct(
                  'Get started with Single Sign-on for your organization by selecting a provider. Read more in our [link:SSO documentation].',
                  {
                    link: <ExternalLink href="https://docs.sentry.io/learn/sso/" />,
                  }
                )}
              </PanelAlert>
            )}

            {warn2FADisable && (
              <PanelAlert m={0} mb={0} type="warning">
                {t('Require 2FA will be disabled if you enable SSO')}
              </PanelAlert>
            )}

            <form
              action={`/organizations/${organization.slug}/auth/configure/`}
              method="POST"
            >
              <input
                type="hidden"
                name="csrfmiddlewaretoken"
                value={getCookie(CSRF_COOKIE_NAME) || ''}
              />
              <input type="hidden" name="init" value="1" />

              {providerList.map(provider => (
                <ProviderItem
                  key={provider.key}
                  provider={provider}
                  active={activeProvider && provider.key === activeProvider.key}
                />
              ))}
              {providerList.length === 0 && (
                <EmptyMessage>
                  {t('No authentication providers are available.')}
                </EmptyMessage>
              )}
            </form>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default OrganizationAuthList;
