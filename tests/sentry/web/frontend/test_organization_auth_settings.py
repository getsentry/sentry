from __future__ import absolute_import

from django.core.urlresolvers import reverse
from mock import patch

from sentry.models import AuthIdentity, AuthProvider, OrganizationMember
from sentry.testutils import AuthProviderTestCase, PermissionTestCase


class OrganizationAuthSettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationAuthSettingsPermissionTest, self).setUp()
        self.auth_provider = AuthProvider.objects.create(
            organization=self.organization,
            provider='dummy',
        )
        AuthIdentity.objects.create(
            user=self.user,
            ident='foo',
            auth_provider=self.auth_provider,
        )
        self.login_as(self.user, organization_id=self.organization.id)
        self.path = reverse(
            'sentry-organization-auth-provider-settings',
            args=[
                self.organization.slug])

    def test_teamless_admin_cannot_load(self):
        with self.feature('organizations:sso'):
            self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_cannot_load(self):
        with self.feature('organizations:sso'):
            self.assert_team_admin_cannot_access(self.path)

    def test_manager_cannot_load(self):
        with self.feature('organizations:sso'):
            self.assert_role_cannot_access(self.path, 'manager')

    def test_owner_can_load(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.organization,
            role="owner",
            teams=[self.team],
        )
        AuthIdentity.objects.create(
            user=user,
            ident='foo2',
            auth_provider=self.auth_provider,
        )
        om = OrganizationMember.objects.get(
            user=user,
            organization=self.organization,
        )
        setattr(om.flags, 'sso:linked', True)
        om.save()

        self.login_as(user, organization_id=self.organization.id)
        with self.feature('organizations:sso'):
            resp = self.client.get(self.path)
            assert resp.status_code == 200


class OrganizationAuthSettingsTest(AuthProviderTestCase):
    def test_can_start_auth_flow(self):
        organization = self.create_organization(name='foo', owner=self.user)

        path = reverse('sentry-organization-auth-provider-settings', args=[organization.slug])

        self.login_as(self.user)

        with self.feature('organizations:sso'):
            resp = self.client.post(path, {'provider': 'dummy', 'init': True})

        assert resp.status_code == 200
        assert resp.content.decode('utf-8') == self.provider.TEMPLATE

    def test_basic_flow(self):
        user = self.create_user('bar@example.com')
        organization = self.create_organization(name='foo', owner=user)

        configure_path = reverse(
            'sentry-organization-auth-provider-settings',
            args=[
                organization.slug])

        self.login_as(user)

        with self.feature('organizations:sso'):
            resp = self.client.post(configure_path, {'provider': 'dummy', 'init': True})

            assert resp.status_code == 200
            assert self.provider.TEMPLATE in resp.content.decode('utf-8')

            path = reverse('sentry-auth-sso')

            resp = self.client.post(path, {'email': user.email})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver{}'.format(configure_path)

        auth_provider = AuthProvider.objects.get(
            organization=organization,
            provider='dummy',
        )

        auth_identity = AuthIdentity.objects.get(
            auth_provider=auth_provider,
        )

        assert user == auth_identity.user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    @patch('sentry.web.frontend.organization_auth_settings.email_unlink_notifications')
    def test_disable_provider(self, email_unlink_notifications):
        self.user.update(is_managed=True)
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

        path = reverse('sentry-organization-auth-provider-settings', args=[organization.slug])

        self.login_as(self.user, organization_id=organization.id)

        with self.feature('organizations:sso'):
            resp = self.client.post(path, {'op': 'disable'})

        assert resp.status_code == 302

        assert not AuthProvider.objects.filter(organization=organization).exists()
        assert not AuthProvider.objects.filter(id=auth_provider.id).exists()

        om = OrganizationMember.objects.get(id=om.id)

        assert not getattr(om.flags, 'sso:linked')
        assert not om.user.is_managed

        assert email_unlink_notifications.delay.called
