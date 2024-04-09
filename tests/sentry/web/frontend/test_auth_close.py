from functools import cached_property
from urllib.parse import quote as urlquote

from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuthClose(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-auth-close")

    def test_renders_auth_close_view(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/auth_close.html")

    def test_renders_auth_close_view_again(self):
        resp = self.client.get(reverse("sentry-login") + "?next=" + urlquote("/auth/close/"))
        self.login_as(self.user)
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/auth_close.html")

    def test_context_anonymous_user(self):
        """page should redirect for unauthenticated user"""
        resp = self.client.get(self.path)
        assert resp.status_code == 302

    def test_context_logged_in(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.context["logged_in"]
