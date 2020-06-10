import PropTypes from 'prop-types';
import React from 'react';

import {CSRF_COOKIE_NAME} from 'app/constants';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {descopeFeatureName} from 'app/utils';
import {t, tct} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import getCookie from 'app/utils/getCookie';

import ProviderItem from './providerItem';

const providerPopularity = {
  google: 0,
  github: 1,
  okta: 2,
  'active-directory': 3,
  saml2: 4,
  onelogin: 5,
  rippling: 6,
  auth0: 7,
};

class OrganizationAuthList extends React.Component {
  static propTypes = {
    providerList: PropTypes.arrayOf(SentryTypes.AuthProvider).isRequired,
    activeProvider: PropTypes.object,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {activeProvider} = this.props;
    const {organization} = this.context;
    const features = organization.features;

    // Sort provider list twice: first, by popularity,
    // and then a second time, to sort unavailable providers for the current plan to the end of the list.
    const sortedByPopularity = (this.props.providerList || []).sort((a, b) => {
      if (!(a.key in providerPopularity)) {
        return -1;
      }
      if (!(b.key in providerPopularity)) {
        return 1;
      }
      if (providerPopularity[a.key] === providerPopularity[b.key]) {
        return 0;
      }
      return providerPopularity[a.key] > providerPopularity[b.key] ? 1 : -1;
    });

    const providerList = sortedByPopularity.sort((a, b) => {
      const aEnabled = features.includes(descopeFeatureName(a.requiredFeature));
      const bEnabled = features.includes(descopeFeatureName(b.requiredFeature));
      if (aEnabled === bEnabled) {
        return 0;
      }
      return aEnabled ? -1 : 1;
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
                {t('Require 2FA will be disabled if you enable SSO.')}
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
