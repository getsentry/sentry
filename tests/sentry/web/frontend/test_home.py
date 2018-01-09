from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase
from sentry.models import TotpInterface, Authenticator


class HomeTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry')

    def test_redirects_to_login(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver/auth/login/'

    def test_redirects_to_create_org(self):
        self.login_as(self.user)

        with self.feature('organizations:create'):
            resp = self.client.get(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver/organizations/new/'

    def test_shows_no_access(self):
        self.login_as(self.user)

        with self.feature({'organizations:create': False}):
            resp = self.client.get(self.path)

        assert resp.status_code == 403
        self.assertTemplateUsed('sentry/no-organization-access.html')

    def test_redirects_to_org_home(self):
        self.login_as(self.user)
        org = self.create_organization(owner=self.user)

        with self.feature('organizations:create'):
            resp = self.client.get(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver/{}/'.format(org.slug)

    def test_blocks_2fa_noncompliant_members(self):
        def redirected_to_2fa_page(response):
            assert response.status_code == 302
            assert reverse('sentry-account-settings-2fa') in response.url

        organization = self.create_organization(owner=self.create_user())
        organization.flags.require_2fa = True
        organization.save()

        user = self.create_user()
        self.create_member(organization=organization, user=user, role="member")
        self.login_as(user)

        response = self.client.get(self.path)
        redirected_to_2fa_page(response)

        TotpInterface().enroll(user)
        response = self.client.get(self.path)
        assert response.status_code == 200

        Authenticator.objects.get(user=user).delete()
        response = self.client.get(self.path)
        redirected_to_2fa_page(response)
