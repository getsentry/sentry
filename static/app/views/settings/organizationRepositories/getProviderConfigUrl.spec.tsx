import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {getProviderPermissionsUrl} from 'sentry/views/settings/organizationRepositories/getProviderConfigUrl';

const githubProvider: OrganizationIntegration['provider'] = {
  key: 'github',
  slug: 'github',
  name: 'GitHub',
  canAdd: true,
  canDisable: true,
  features: [],
  aspects: {},
};

describe('getProviderPermissionsUrl()', () => {
  it('uses the personal namespace for a user-owned GitHub installation', () => {
    expect(
      getProviderPermissionsUrl(
        OrganizationIntegrationsFixture({
          provider: githubProvider,
          externalId: '123456',
          accountType: 'User',
          domainName: 'github.com/example-user',
        })
      )
    ).toBe('https://github.com/settings/installations/123456/permissions/update');
  });

  it('uses the organization namespace for an org-owned GitHub installation', () => {
    expect(
      getProviderPermissionsUrl(
        OrganizationIntegrationsFixture({
          provider: githubProvider,
          externalId: '654321',
          accountType: 'Organization',
          domainName: 'github.com/example-org',
        })
      )
    ).toBe(
      'https://github.com/organizations/example-org/settings/installations/654321/permissions/update'
    );
  });

  it('returns null without an installation id', () => {
    expect(
      getProviderPermissionsUrl(
        OrganizationIntegrationsFixture({
          provider: githubProvider,
          externalId: '',
          accountType: 'User',
          domainName: 'github.com/example-user',
        })
      )
    ).toBeNull();
  });
});
