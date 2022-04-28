from django.urls import reverse
from exam import fixture

from sentry.testutils import TestCase
from sentry.utils import json
from sentry.utils.client_state import get_client_state_key, get_redis_client


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

        self.assertRedirects(resp, f"/organizations/{org.slug}/issues/")

    def test_redirect_to_onboarding(self):
        self.login_as(self.user)
        org = self.create_organization(owner=self.user)

        key = get_client_state_key(org.slug, "onboarding", None)
        get_redis_client().set(key, json.dumps({"state": "started", "url": "select-platform/"}))
        resp = self.client.get(self.path)
        self.assertRedirects(resp, f"/onboarding/{org.slug}/select-platform/")
