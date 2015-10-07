from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuthIdentity, AuthProvider, OrganizationMember
from sentry.testutils import AuthProviderTestCase


# TODO(dcramer): this is an integration test
class OrganizationAuthSettingsTest(AuthProviderTestCase):
    def test_renders_basic_login_form(self):
        organization = self.create_organization(name='foo', owner=self.user)

        path = reverse('sentry-auth-organization', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-login.html')

        assert resp.context['form']
        assert 'provider_key' not in resp.context
        assert resp.context['CAN_REGISTER']

    def test_basic_provider_flow_as_anonymous(self):
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': 'foo@example.com'})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-identity.html')
        assert resp.status_code == 200

        resp = self.client.post(path, {'op': 'newuser'})

        assert resp.status_code == 302

        auth_identity = AuthIdentity.objects.get(
            auth_provider=auth_provider,
        )

        user = auth_identity.user
        assert user.email == 'foo@example.com'

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_basic_provider_flow_as_existing_user(self):
        organization = self.create_organization(name='foo', owner=self.user)
        AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        user = self.create_user('bar@example.com')

        path = reverse('sentry-auth-organization', args=[organization.slug])

        self.login_as(user)

        resp = self.client.post(path)

        assert resp.status_code == 302
