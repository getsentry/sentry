from __future__ import absolute_import

import pytest
from sentry.utils.compat import mock

from django.test import override_settings
from django.conf import settings
from django.core.urlresolvers import reverse
from django.utils.http import urlquote
from exam import fixture

from sentry import options, newsletter
from sentry.testutils import TestCase
from sentry.models import OrganizationMember, User


# TODO(dcramer): need tests for SSO behavior and single org behavior
class AuthLoginTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-login")

    def test_renders_correct_template(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/login.html")

    def test_cannot_request_access(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        assert resp.context["join_request_link"] is None

    def test_renders_session_expire_message(self):
        self.client.cookies["session_expired"] = "1"
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/login.html")
        assert len(resp.context["messages"]) == 1

    def test_login_invalid_password(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path, {"username": self.user.username, "password": "bizbar", "op": "login"}
        )
        assert resp.status_code == 200
        assert resp.context["login_form"].errors["__all__"] == [
            u"Please enter a correct username and password. Note that both fields may be case-sensitive."
        ]

    def test_login_valid_credentials(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path, {"username": self.user.username, "password": "admin", "op": "login"}
        )
        assert resp.status_code == 302

    def test_registration_disabled(self):
        options.set("auth.allow-registration", True)
        with self.feature({"auth:register": False}):
            resp = self.client.get(self.path)
            assert resp.context["register_form"] is None

    @mock.patch("sentry.analytics.record")
    def test_registration_valid(self, mock_record):
        options.set("auth.allow-registration", True)
        with self.feature("auth:register"):
            resp = self.client.post(
                self.path,
                {
                    "username": "test-a-really-long-email-address@example.com",
                    "password": "foobar",
                    "name": "Foo Bar",
                    "op": "register",
                },
            )
        assert resp.status_code == 302, (
            resp.context["register_form"].errors if resp.status_code == 200 else None
        )
        user = User.objects.get(username="test-a-really-long-email-address@example.com")
        assert user.email == "test-a-really-long-email-address@example.com"
        assert user.check_password("foobar")
        assert user.name == "Foo Bar"
        assert not OrganizationMember.objects.filter(user=user).exists()

        signup_record = [r for r in mock_record.call_args_list if r[0][0] == "user.signup"]
        assert signup_record == [
            mock.call(
                "user.signup",
                user_id=user.id,
                source="register-form",
                provider=None,
                referrer="in-app",
            )
        ]

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    def test_registration_single_org(self):
        options.set("auth.allow-registration", True)
        with self.feature("auth:register"):
            resp = self.client.post(
                self.path,
                {
                    "username": "test-a-really-long-email-address@example.com",
                    "password": "foobar",
                    "name": "Foo Bar",
                    "op": "register",
                },
            )
        assert resp.status_code == 302, (
            resp.context["register_form"].errors if resp.status_code == 200 else None
        )
        user = User.objects.get(username="test-a-really-long-email-address@example.com")

        # User is part of the default org
        assert OrganizationMember.objects.filter(user=user).exists()

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @mock.patch("sentry.web.frontend.auth_login.ApiInviteHelper.from_cookie")
    def test_registration_single_org_with_invite(self, from_cookie):
        self.session["can_register"] = True
        self.save_session()

        self.client.get(self.path)

        invite_helper = mock.Mock(valid_request=True)
        from_cookie.return_value = invite_helper

        resp = self.client.post(
            self.path,
            {
                "username": "test@example.com",
                "password": "foobar",
                "name": "Foo Bar",
                "op": "register",
            },
        )

        user = User.objects.get(username="test@example.com")

        # An organization member should NOT have been created, even though
        # we're in single org mode, accepting the invite will handle that
        # (which we assert next)
        assert not OrganizationMember.objects.filter(user=user).exists()

        # Invitation was accepted
        assert len(invite_helper.accept_invite.mock_calls) == 1
        assert resp.status_code == 302

    def test_register_renders_correct_template(self):
        options.set("auth.allow-registration", True)
        register_path = reverse("sentry-register")
        resp = self.client.get(register_path)

        assert resp.status_code == 200
        assert resp.context["op"] == "register"
        self.assertTemplateUsed("sentry/login.html")

    def test_register_prefills_invite_email(self):
        self.session["invite_email"] = "foo@example.com"
        self.session["can_register"] = True
        self.save_session()

        register_path = reverse("sentry-register")
        resp = self.client.get(register_path)

        assert resp.status_code == 200
        assert resp.context["op"] == "register"
        assert resp.context["register_form"].initial["username"] == "foo@example.com"
        self.assertTemplateUsed("sentry/login.html")

    @mock.patch("sentry.web.frontend.auth_login.ApiInviteHelper.from_cookie")
    def test_register_accepts_invite(self, from_cookie):
        self.session["can_register"] = True
        self.save_session()

        self.client.get(self.path)

        invite_helper = mock.Mock(valid_request=True)
        from_cookie.return_value = invite_helper

        resp = self.client.post(
            self.path,
            {
                "username": "test@example.com",
                "password": "foobar",
                "name": "Foo Bar",
                "op": "register",
            },
        )
        assert resp.status_code == 302
        assert len(invite_helper.accept_invite.mock_calls) == 1

    def test_redirects_to_relative_next_url(self):
        next = "/welcome"
        self.client.get(self.path + "?next=" + next)

        resp = self.client.post(
            self.path, {"username": self.user.username, "password": "admin", "op": "login"}
        )
        assert resp.status_code == 302
        assert resp.get("Location", "").endswith(next)

    def test_doesnt_redirect_to_external_next_url(self):
        next = "http://example.com"
        self.client.get(self.path + "?next=" + urlquote(next))

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=False,
        )
        self.assertRedirects(resp, reverse("sentry-login"), target_status_code=302)
        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        self.assertRedirects(resp, "/organizations/new/")

    def test_redirects_already_authed_non_superuser(self):
        self.user.update(is_superuser=False)
        self.login_as(self.user)
        with self.feature("organizations:create"):
            resp = self.client.get(self.path)
            self.assertRedirects(resp, "/organizations/new/")

    def test_doesnt_redirect_already_authed_superuser(self):
        self.login_as(self.user, superuser=False)

        resp = self.client.get(self.path)

        assert resp.status_code == 200


@pytest.mark.skipIf(
    lambda x: settings.SENTRY_NEWSLETTER != "sentry.newsletter.dummy.DummyNewsletter"
)
class AuthLoginNewsletterTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-login")

    def setUp(self):
        super(AuthLoginNewsletterTest, self).setUp()

        def disable_newsletter():
            newsletter.backend.disable()

        self.addCleanup(disable_newsletter)
        newsletter.backend.enable()

    def test_registration_requires_subscribe_choice_with_newsletter(self):
        options.set("auth.allow-registration", True)
        with self.feature("auth:register"):
            resp = self.client.post(
                self.path,
                {
                    "username": "test-a-really-long-email-address@example.com",
                    "password": "foobar",
                    "name": "Foo Bar",
                    "op": "register",
                },
            )
        assert resp.status_code == 200

        with self.feature("auth:register"):
            resp = self.client.post(
                self.path,
                {
                    "username": "test-a-really-long-email-address@example.com",
                    "password": "foobar",
                    "name": "Foo Bar",
                    "op": "register",
                    "subscribe": "0",
                },
            )
        assert resp.status_code == 302

        user = User.objects.get(username="test-a-really-long-email-address@example.com")
        assert user.email == "test-a-really-long-email-address@example.com"
        assert user.check_password("foobar")
        assert user.name == "Foo Bar"
        assert not OrganizationMember.objects.filter(user=user).exists()

        assert newsletter.get_subscriptions(user) == {"subscriptions": []}

    def test_registration_subscribe_to_newsletter(self):
        options.set("auth.allow-registration", True)
        with self.feature("auth:register"):
            resp = self.client.post(
                self.path,
                {
                    "username": "test-a-really-long-email-address@example.com",
                    "password": "foobar",
                    "name": "Foo Bar",
                    "op": "register",
                    "subscribe": "1",
                },
            )
        assert resp.status_code == 302

        user = User.objects.get(username="test-a-really-long-email-address@example.com")
        assert user.email == "test-a-really-long-email-address@example.com"
        assert user.check_password("foobar")
        assert user.name == "Foo Bar"

        results = newsletter.get_subscriptions(user)["subscriptions"]
        assert len(results) == 1
        assert results[0].list_id == newsletter.get_default_list_id()
        assert results[0].subscribed
        assert not results[0].verified
