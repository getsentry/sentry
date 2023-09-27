import {AuthProviders} from 'sentry-fixture/authProviders';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OrganizationAuthList} from 'sentry/views/settings/organizationAuth/organizationAuthList';

describe('OrganizationAuthList', function () {
  it('renders with no providers', function () {
    render(
      <OrganizationAuthList organization={TestStubs.Organization()} providerList={[]} />
    );

    expect(
      screen.queryByText('No authentication providers are available.')
    ).toBeInTheDocument();
  });

  it('renders', function () {
    render(
      <OrganizationAuthList
        organization={TestStubs.Organization()}
        providerList={AuthProviders()}
      />
    );

    expect(screen.getAllByLabelText('Configure').length).toBe(2);
    expect(screen.queryByText('Dummy')).toBeInTheDocument();
    expect(screen.queryByText('Dummy SAML')).toBeInTheDocument();
  });

  it('renders for members', function () {
    const context = TestStubs.routerContext([
      {organization: TestStubs.Organization({access: ['org:read']})},
    ]);

    render(
      <OrganizationAuthList
        organization={TestStubs.Organization()}
        providerList={AuthProviders()}
        activeProvider={AuthProviders()[0]}
      />,
      {context}
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  describe('with 2fa warning', function () {
    const require2fa = {require2FA: true};
    const withSSO = {features: ['sso-basic']};
    const withSAML = {features: ['sso-saml2']};

    it('renders', function () {
      const organization = TestStubs.Organization({...require2fa, ...withSSO});
      const context = TestStubs.routerContext([{organization}]);

      render(
        <OrganizationAuthList
          organization={organization}
          providerList={AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.getByText('Require 2FA will be disabled if you enable SSO.')
      ).toBeInTheDocument();
    });

    it('renders with saml available', function () {
      const organization = TestStubs.Organization({...require2fa, ...withSAML});
      const context = TestStubs.routerContext([{organization}]);

      render(
        <OrganizationAuthList
          organization={organization}
          providerList={AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.getByText('Require 2FA will be disabled if you enable SSO.')
      ).toBeInTheDocument();
    });

    it('does not render without sso available', function () {
      const organization = TestStubs.Organization({...require2fa});
      const context = TestStubs.routerContext([{organization}]);

      render(
        <OrganizationAuthList
          organization={organization}
          providerList={AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });

    it('does not render with sso and require 2fa disabled', function () {
      const organization = TestStubs.Organization({...withSSO});
      const context = TestStubs.routerContext([{organization}]);

      render(
        <OrganizationAuthList
          organization={organization}
          providerList={AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });

    it('does not render with saml and require 2fa disabled', function () {
      const organization = TestStubs.Organization({...withSAML});
      const context = TestStubs.routerContext([{organization}]);

      render(
        <OrganizationAuthList
          organization={organization}
          providerList={AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });
  });
});
