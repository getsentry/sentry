import {AuthProviderFixture} from 'sentry-fixture/authProvider';
import {AuthProvidersFixture} from 'sentry-fixture/authProviders';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OrganizationAuthList} from './organizationAuthList';

describe('OrganizationAuthList', () => {
  it('renders with no providers', () => {
    render(<OrganizationAuthList providerList={[]} />);

    expect(
      screen.getByText('No authentication providers are available.')
    ).toBeInTheDocument();
  });

  it('renders', () => {
    render(<OrganizationAuthList providerList={AuthProvidersFixture()} />);

    expect(screen.getAllByLabelText('Configure')).toHaveLength(2);
    expect(screen.getByText('Dummy')).toBeInTheDocument();
    expect(screen.getByText('Dummy SAML')).toBeInTheDocument();
  });

  it('lists OpenID Connect after the named providers', () => {
    const provider = (key: string, name: string) =>
      AuthProviderFixture({key, name, requiredFeature: 'organizations:sso-basic'});

    render(
      <OrganizationAuthList
        providerList={[
          provider('oidc', 'OpenID Connect'),
          provider('saml2', 'SAML2'),
          provider('google', 'Google'),
        ]}
      />,
      {organization: OrganizationFixture({features: ['sso-basic']})}
    );

    const names = screen
      .getAllByText(/^(Google|SAML2|OpenID Connect)$/)
      .map(el => el.textContent);
    expect(names).toEqual(['Google', 'SAML2', 'OpenID Connect']);
  });

  it('renders for members', () => {
    const organization = OrganizationFixture({access: ['org:read']});

    render(
      <OrganizationAuthList
        providerList={AuthProvidersFixture()}
        activeProvider={AuthProvidersFixture()[0]}
      />,
      {organization}
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  describe('with 2fa warning', () => {
    const require2fa = {require2FA: true};
    const withSSO = {features: ['sso-basic']};
    const withSAML = {features: ['sso-saml2']};

    it('renders', () => {
      const organization = OrganizationFixture({...require2fa, ...withSSO});

      render(<OrganizationAuthList providerList={AuthProvidersFixture()} />, {
        organization,
      });

      expect(
        screen.getByText('Require 2FA will be disabled if you enable SSO.')
      ).toBeInTheDocument();
    });

    it('renders with saml available', () => {
      const organization = OrganizationFixture({...require2fa, ...withSAML});

      render(<OrganizationAuthList providerList={AuthProvidersFixture()} />, {
        organization,
      });

      expect(
        screen.getByText('Require 2FA will be disabled if you enable SSO.')
      ).toBeInTheDocument();
    });

    it('does not render without sso available', () => {
      const organization = OrganizationFixture({...require2fa});

      render(<OrganizationAuthList providerList={AuthProvidersFixture()} />, {
        organization,
      });

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });

    it('does not render with sso and require 2fa disabled', () => {
      const organization = OrganizationFixture({...withSSO});

      render(<OrganizationAuthList providerList={AuthProvidersFixture()} />, {
        organization,
      });

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });

    it('does not render with saml and require 2fa disabled', () => {
      const organization = OrganizationFixture({...withSAML});

      render(<OrganizationAuthList providerList={AuthProvidersFixture()} />, {
        organization,
      });

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });
  });
});
