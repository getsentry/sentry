from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.core.cache import cache

from sentry.testutils import PermissionTestCase
from sentry.api.endpoints.setup_wizard import SETUP_WIZARD_CACHE_KEY


class SetupWizard(PermissionTestCase):
    def test_redirect(self):
        user = self.create_user("foo@example.com", is_active=False)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        self.login_as(user)

        assert resp.status_code == 302

    def test_simple(self):
        self.create_organization(owner=self.user)

        self.login_as(self.user)

        key = "%s%s" % (SETUP_WIZARD_CACHE_KEY, "abc")
        cache.set(key, "test")

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/setup-wizard.html")

    def test_redirect_to_org(self):
        self.create_organization(owner=self.user)

        self.login_as(self.user)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "xyz"})
        resp = self.client.get(url)

        assert resp.status_code == 302

    def test_project(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)

        key = "%s%s" % (SETUP_WIZARD_CACHE_KEY, "abc")
        cache.set(key, "test")

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/setup-wizard.html")
        cached = cache.get(key)
        assert cached.get("apiKeys").get("scopes")[0] == "project:releases"
        assert cached.get("projects")[0].get("status") == "active"
        assert cached.get("projects")[0].get("keys")[0].get("isActive")
        assert cached.get("projects")[0].get("organization").get("status").get("id") == "active"
