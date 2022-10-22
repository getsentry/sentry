import {AuthProviders} from 'fixtures/js-stubs/authProviders';
import {Organization} from 'fixtures/js-stubs/organization';
import {routerContext} from 'fixtures/js-stubs/routerContext';

import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationAuthList from 'sentry/views/settings/organizationAuth/organizationAuthList';

describe('OrganizationAuthList', function () {
  it('renders with no providers', function () {
    const wrapper = mountWithTheme(<OrganizationAuthList providerList={[]} />);

    expect(wrapper).toSnapshot();
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={AuthProviders()}
      />
    );

    expect(wrapper).toSnapshot();
  });

  it('renders for members', function () {
    const wrapper = mountWithTheme(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={AuthProviders()}
        activeProvider={AuthProviders()[0]}
      />,
      routerContext([
        {
          organization: Organization({access: ['org:read']}),
        },
      ])
    );

    expect(wrapper.find('ProviderItem ActiveIndicator')).toHaveLength(1);
  });

  describe('with 2fa warning', function () {
    const require2fa = {require2FA: true};
    const withSSO = {features: ['sso-basic']};
    const withSAML = {features: ['sso-saml2']};

    it('renders', function () {
      const context = routerContext([
        {organization: Organization({...require2fa, ...withSSO})},
      ]);

      const wrapper = mountWithTheme(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={AuthProviders()}
        />,
        context
      );

      expect(wrapper.find('PanelAlert[type="warning"]').exists()).toBe(true);
    });

    it('renders with saml available', function () {
      const context = routerContext([
        {organization: Organization({...require2fa, ...withSAML})},
      ]);

      const wrapper = mountWithTheme(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={AuthProviders()}
        />,
        context
      );

      expect(wrapper.find('PanelAlert[type="warning"]').exists()).toBe(true);
    });

    it('does not render without sso available', function () {
      const context = routerContext([{organization: Organization({...require2fa})}]);

      const wrapper = mountWithTheme(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={AuthProviders()}
        />,
        context
      );

      expect(wrapper.find('PanelAlert[type="warning"]').exists()).toBe(false);
    });

    it('does not render with sso and require 2fa disabled', function () {
      const context = routerContext([{organization: Organization({...withSSO})}]);

      const wrapper = mountWithTheme(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={AuthProviders()}
        />,
        context
      );

      expect(wrapper.find('PanelAlert[type="warning"]').exists()).toBe(false);
    });

    it('does not render with saml and require 2fa disabled', function () {
      const context = routerContext([{organization: Organization({...withSAML})}]);

      const wrapper = mountWithTheme(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={AuthProviders()}
        />,
        context
      );

      expect(wrapper.find('PanelAlert[type="warning"]').exists()).toBe(false);
    });
  });
});
