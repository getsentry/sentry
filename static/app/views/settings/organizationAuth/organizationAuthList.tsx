import ExternalLink from 'app/components/links/externalLink';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {AuthProvider, Organization} from 'app/types';
import {descopeFeatureName} from 'app/utils';
import getCsrfToken from 'app/utils/getCsrfToken';
import withOrganization from 'app/utils/withOrganization';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

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

type Props = {
  organization: Organization;
  providerList: AuthProvider[];
  activeProvider?: AuthProvider;
};

const OrganizationAuthList = ({organization, providerList, activeProvider}: Props) => {
  const features = organization.features;

  // Sort provider list twice: first, by popularity,
  // and then a second time, to sort unavailable providers for the current plan to the end of the list.
  const sortedByPopularity = (providerList ?? []).sort((a, b) => {
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

  const list = sortedByPopularity.sort((a, b) => {
    const aEnabled = features.includes(descopeFeatureName(a.requiredFeature));
    const bEnabled = features.includes(descopeFeatureName(b.requiredFeature));
    if (aEnabled === bEnabled) {
      return 0;
    }
    return aEnabled ? -1 : 1;
  });

  const warn2FADisable =
    organization.require2FA &&
    list.some(({requiredFeature}) =>
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
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/accounts/sso/" />
                  ),
                }
              )}
            </PanelAlert>
          )}

          {warn2FADisable && (
            <PanelAlert type="warning">
              {t('Require 2FA will be disabled if you enable SSO.')}
            </PanelAlert>
          )}

          <form
            action={`/organizations/${organization.slug}/auth/configure/`}
            method="POST"
          >
            <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />
            <input type="hidden" name="init" value="1" />

            {list.map(provider => (
              <ProviderItem
                key={provider.key}
                provider={provider}
                active={!!activeProvider && provider.key === activeProvider.key}
              />
            ))}
            {list.length === 0 && (
              <EmptyMessage>
                {t('No authentication providers are available.')}
              </EmptyMessage>
            )}
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
};

export default withOrganization(OrganizationAuthList);
