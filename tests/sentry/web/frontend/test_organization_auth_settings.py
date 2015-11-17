from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuthIdentity, AuthProvider, OrganizationMember
from sentry.testutils import AuthProviderTestCase, PermissionTestCase


class OrganizationAuthSettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationAuthSettingsPermissionTest, self).setUp()
        self.path = reverse('sentry-organization-auth-settings', args=[self.organization.slug])

    def test_teamless_admin_cannot_load(self):
        with self.feature('organizations:sso'):
            self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_cannot_load(self):
        with self.feature('organizations:sso'):
            self.assert_team_admin_cannot_access(self.path)

    def test_owner_can_load(self):
        with self.feature('organizations:sso'):
            self.assert_owner_can_access(self.path)


class OrganizationAuthSettingsTest(AuthProviderTestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)

        path = reverse('sentry-organization-auth-settings', args=[organization.slug])

        self.login_as(self.user)

        with self.feature('organizations:sso'):
            resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-auth-settings.html')

        assert resp.context['organization'] == organization
        assert 'dummy' in [k for k, v in resp.context['provider_list']]

    def test_can_start_auth_flow(self):
        organization = self.create_organization(name='foo', owner=self.user)

        path = reverse('sentry-organization-auth-settings', args=[organization.slug])

        self.login_as(self.user)

        with self.feature('organizations:sso'):
            resp = self.client.post(path, {'provider': 'dummy'})

        assert resp.status_code == 200
        assert resp.content == self.provider.TEMPLATE

    def test_disable_provider(self):
        organization = self.create_organization(name='foo', owner=self.user)

        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        AuthIdentity.objects.create(
            user=self.user,
            ident='foo',
            auth_provider=auth_provider,
        )

        om = OrganizationMember.objects.get(
            user=self.user,
            organization=organization,
        )
        setattr(om.flags, 'sso:linked', True)
        om.save()

        path = reverse('sentry-organization-auth-settings', args=[organization.slug])

        self.login_as(self.user)

        with self.feature('organizations:sso'):
            resp = self.client.post(path, {'op': 'disable'})

        assert resp.status_code == 302

        assert not AuthProvider.objects.filter(organization=organization).exists()
        assert not AuthProvider.objects.filter(id=auth_provider.id).exists()

        om = OrganizationMember.objects.get(id=om.id)

        assert not getattr(om.flags, 'sso:linked')
