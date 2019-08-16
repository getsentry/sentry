from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.http import urlquote

from exam import fixture

from sentry.testutils import TestCase


class AuthClose(TestCase):
    @fixture
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
        assert resp.context["logged_in"] is True
