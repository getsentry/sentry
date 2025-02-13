import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {AuthProvider} from 'sentry/types/auth';
import type {Organization} from 'sentry/types/organization';
import {descopeFeatureName} from 'sentry/utils';
import getCsrfToken from 'sentry/utils/getCsrfToken';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import ProviderItem from './providerItem';

const PROVIDER_POPULARITY: Record<string, number> = {
  google: 0,
  github: 1,
  okta: 2,
  'active-directory': 3,
  saml2: 4,
  onelogin: 5,
  rippling: 6,
  auth0: 7,
  jumpcloud: 8,
};

type Props = {
  organization: Organization;
  providerList: AuthProvider[];
  activeProvider?: AuthProvider;
};

function OrganizationAuthList({organization, providerList, activeProvider}: Props) {
  const features = organization.features;

  // Sort provider list twice: first, by popularity,
  // and then a second time, to sort unavailable providers for the current plan to the end of the list.
  const sortedByPopularity = (providerList ?? []).sort((a, b) => {
    if (!(a.key in PROVIDER_POPULARITY)) {
      return -1;
    }
    if (!(b.key in PROVIDER_POPULARITY)) {
      return 1;
    }
    if (PROVIDER_POPULARITY[a.key] === PROVIDER_POPULARITY[b.key]) {
      return 0;
    }
    return PROVIDER_POPULARITY[a.key]! > PROVIDER_POPULARITY[b.key]! ? 1 : -1;
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
      <OrganizationPermissionAlert margin={false} />
      <Panel>
        <PanelHeader>{t('Choose a provider')}</PanelHeader>
        <PanelBody>
          {!activeProvider && (
            <PanelAlert margin={false} type="info">
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
            <PanelAlert margin={false} type="warning">
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
}

export default withOrganization(OrganizationAuthList);

// For tests
export {OrganizationAuthList};
