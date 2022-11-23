import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationAuthList from 'sentry/views/settings/organizationAuth/organizationAuthList';

describe('OrganizationAuthList', function () {
  it('renders with no providers', function () {
    const {container} = render(<OrganizationAuthList providerList={[]} />);

    expect(container).toSnapshot();
  });

  it('renders', function () {
    const {container} = render(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProviders()}
      />
    );

    expect(container).toSnapshot();
  });

  it('renders for members', function () {
    const context = TestStubs.routerContext([
      {organization: TestStubs.Organization({access: ['org:read']})},
    ]);

    render(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProviders()}
        activeProvider={TestStubs.AuthProviders()[0]}
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
      const context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...require2fa, ...withSSO})},
      ]);

      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.getByText('Require 2FA will be disabled if you enable SSO.')
      ).toBeInTheDocument();
    });

    it('renders with saml available', function () {
      const context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...require2fa, ...withSAML})},
      ]);

      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.getByText('Require 2FA will be disabled if you enable SSO.')
      ).toBeInTheDocument();
    });

    it('does not render without sso available', function () {
      const context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...require2fa})},
      ]);

      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });

    it('does not render with sso and require 2fa disabled', function () {
      const context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...withSSO})},
      ]);

      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });

    it('does not render with saml and require 2fa disabled', function () {
      const context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...withSAML})},
      ]);

      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
        />,
        {context}
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });
  });
});
