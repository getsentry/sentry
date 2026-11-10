import {AuthProviderFixture} from 'sentry-fixture/authProvider';
import {AuthProvidersFixture} from 'sentry-fixture/authProviders';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {descopeFeatureName} from 'sentry/utils';

import {ProviderItem} from './providerItem';

describe('ProviderItem', () => {
  const provider = AuthProvidersFixture()[0]!;
  const org = OrganizationFixture({
    features: [descopeFeatureName(provider.requiredFeature)],
  });

  it('renders', () => {
    render(<ProviderItem active={false} provider={provider} />, {
      organization: org,
    });

    expect(
      screen.getByText('Enable your organization to sign in with Dummy.')
    ).toBeInTheDocument();
  });

  it('describes the OpenID Connect provider', () => {
    const oidc = AuthProviderFixture({
      key: 'oidc',
      name: 'OpenID Connect',
      requiredFeature: 'organizations:sso-oidc',
    });
    render(<ProviderItem active={false} provider={oidc} />, {
      organization: OrganizationFixture({features: ['sso-oidc']}),
    });

    expect(
      screen.getByText(
        'Enable your organization to sign in with your preferred OpenID Connect provider like Keycloak, Authentik, or Zitadel.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Configure'})).toBeEnabled();
  });

  it('renders a disabled Tag when disabled', () => {
    render(<ProviderItem active={false} provider={provider} />, {
      organization: OrganizationFixture(),
    });

    expect(screen.getByRole('status')).toHaveTextContent('disabled');
  });
});
