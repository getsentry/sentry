from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuthIdentity, AuthProvider, OrganizationMember
from sentry.testutils import AuthProviderTestCase


# TODO(dcramer): this is an integration test
class OrganizationAuthSettingsTest(AuthProviderTestCase):
    def test_redirects_with_no_provider(self):
        organization = self.create_organization(name='foo', owner=self.user)
        path = reverse('sentry-auth-link-identity', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 302

    def test_renders_login_form_as_anon(self):
        organization = self.create_organization(name='foo', owner=self.user)
        AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        path = reverse('sentry-auth-link-identity', args=[organization.slug])

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/auth-link-login.html')

        assert resp.context['form']

    def test_flow_as_anonymous(self):
        organization = self.create_organization(name='foo', owner=self.user)
        AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        path = reverse('sentry-auth-link-identity', args=[organization.slug])

        resp = self.client.post(path, {
            'username': self.user.username,
            'password': 'admin',
        }, follow=True)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/auth-link-identity.html')

    def test_flow_as_existing_user(self):
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        user = self.create_user('bar@example.com')
        member = self.create_member(organization=organization, user=user)

        path = reverse('sentry-auth-link-identity', args=[organization.slug])

        self.login_as(user)

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': 'bar@example.com'})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-link.html')
        assert resp.status_code == 200

        resp = self.client.post(path, {'op': 'confirm'})

        assert resp.status_code == 302

        auth_identity = AuthIdentity.objects.get(
            auth_provider=auth_provider,
        )

        assert auth_identity.user == user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')
