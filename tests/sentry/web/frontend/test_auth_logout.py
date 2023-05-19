from functools import cached_property
from urllib.parse import quote

from django.urls import reverse

from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class AuthLogoutTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-logout")

    def test_get_shows_page(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert self.client.session.keys(), "Not logged out yet"

    def test_logs_user_out(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        assert list(self.client.session.keys()) == []

    def test_same_behavior_with_anonymous_user(self):
        resp = self.client.post(self.path)
        assert resp.status_code == 302
        assert list(self.client.session.keys()) == []

    def test_redirects_to_relative_next_url(self):
        self.login_as(self.user)

        next = "/welcome"
        resp = self.client.post(self.path + "?next=" + next)
        assert resp.status_code == 302
        assert resp.get("Location", "").endswith(next)

    def test_doesnt_redirect_to_external_next_url(self):
        next = "http://example.com"
        resp = self.client.post(self.path + "?next=" + quote(next))
        self.assertRedirects(resp, "/auth/login/")

        resp = self.client.post(self.path + "?next=" + quote("http:1234556"))
        self.assertRedirects(resp, "/auth/login/")

        resp = self.client.post(self.path + "?next=" + quote("///example.com"))
        self.assertRedirects(resp, "/auth/login/")

        resp = self.client.post(self.path + "?next=" + quote("http:///example.com"))
        self.assertRedirects(resp, "/auth/login/")
