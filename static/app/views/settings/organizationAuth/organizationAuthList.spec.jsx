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
    render(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProviders()}
        activeProvider={TestStubs.AuthProviders()[0]}
        organization={TestStubs.Organization({access: ['org:read']})}
      />
    );

    expect(screen.getByTestId('provider-active-indicator')).toBeInTheDocument();
  });

  describe('with 2fa warning', function () {
    const require2fa = {require2FA: true};
    const withSSO = {features: ['sso-basic']};
    const withSAML = {features: ['sso-saml2']};

    it('displays warning with sso available', function () {
      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
          organization={TestStubs.Organization({...require2fa, ...withSSO})}
        />
      );

      expect(
        screen.getByText('Require 2FA will be disabled if you enable SSO.')
      ).toBeInTheDocument();
    });

    it('displays warning with saml available', function () {
      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
          organization={TestStubs.Organization({...require2fa, ...withSAML})}
        />
      );

      expect(
        screen.getByText('Require 2FA will be disabled if you enable SSO.')
      ).toBeInTheDocument();
    });

    it('does not display warning without sso available', function () {
      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
          organization={TestStubs.Organization({...require2fa})}
        />
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });

    it('does not display warning with sso and require 2fa disabled', function () {
      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
          organization={TestStubs.Organization({...withSSO})}
        />
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });

    it('does not render with saml and require 2fa disabled', function () {
      render(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
          organization={TestStubs.Organization({...withSAML})}
        />
      );

      expect(
        screen.queryByText('Require 2FA will be disabled if you enable SSO.')
      ).not.toBeInTheDocument();
    });
  });
});
