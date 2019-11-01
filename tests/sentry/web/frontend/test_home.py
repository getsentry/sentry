from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase


class HomeTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry")

    def test_redirects_to_login(self):
        resp = self.client.get(self.path)

        self.assertRedirects(resp, "/auth/login/")

    def test_redirects_to_create_org(self):
        self.login_as(self.user)

        with self.feature("organizations:create"):
            resp = self.client.get(self.path)

        self.assertRedirects(resp, "/organizations/new/")

    def test_shows_no_access(self):
        self.login_as(self.user)

        with self.feature({"organizations:create": False}):
            resp = self.client.get(self.path)

        assert resp.status_code == 403
        self.assertTemplateUsed("sentry/no-organization-access.html")

    def test_redirects_to_org_home(self):
        self.login_as(self.user)
        org = self.create_organization(owner=self.user)

        with self.feature("organizations:create"):
            resp = self.client.get(self.path)

        self.assertRedirects(resp, u"/organizations/{}/issues/".format(org.slug))
