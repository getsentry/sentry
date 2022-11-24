from unittest import mock
from urllib.parse import urlencode

import pytest
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from django.utils.http import urlquote
from exam import fixture

from sentry import newsletter, options
from sentry.auth.authenticators import RecoveryCodeInterface, TotpInterface
from sentry.models import OrganizationMember, User
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.client_state import get_client_state_key, get_redis_client


# TODO(dcramer): need tests for SSO behavior and single org behavior
# @control_silo_test(stable=True)
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
            "Please enter a correct username and password. Note that both fields may be case-sensitive."
        ]

    def test_login_valid_credentials(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/new/", 302),
        ]

    def test_login_valid_credentials_with_org(self):
        org = self.create_organization(owner=self.user)
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            (f"/organizations/{org.slug}/issues/", 302),
        ]

    def test_login_valid_credentials_2fa_redirect(self):
        user = self.create_user("bar@example.com")
        RecoveryCodeInterface().enroll(user)
        TotpInterface().enroll(user)
        self.create_member(organization=self.organization, user=user)

        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [(reverse("sentry-2fa-dialog"), 302)]

        with mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=True):
            resp = self.client.post(reverse("sentry-2fa-dialog"), {"otp": "something"}, follow=True)
            assert resp.status_code == 200
            assert resp.redirect_chain == [
                (reverse("sentry-login"), 302),
                ("/organizations/baz/issues/", 302),
            ]

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
        frontend_events = {"event_name": "Sign Up"}
        marketing_query = urlencode({"frontend_events": json.dumps(frontend_events)})
        assert marketing_query in resp.url

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
    @mock.patch("sentry.web.frontend.auth_login.ApiInviteHelper.from_session")
    def test_registration_single_org_with_invite(self, from_session):
        self.session["can_register"] = True
        self.save_session()

        self.client.get(self.path)

        invite_helper = mock.Mock(valid_request=True)
        from_session.return_value = invite_helper

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

    @mock.patch("sentry.web.frontend.auth_login.ApiInviteHelper.from_session")
    def test_register_accepts_invite(self, from_session):
        self.session["can_register"] = True
        self.save_session()

        self.client.get(self.path)

        invite_helper = mock.Mock(valid_request=True)
        from_session.return_value = invite_helper

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
            follow=True,
        )
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/new/", 302),
        ]

    def test_redirects_already_authed_non_superuser(self):
        self.user.update(is_superuser=False)
        self.login_as(self.user)
        with self.feature("organizations:create"):
            resp = self.client.get(self.path)
            self.assertRedirects(resp, "/organizations/new/")

    def test_redirect_superuser(self):
        self.login_as(self.user, superuser=False)

        resp = self.client.get(self.path)

        with self.feature("organizations:create"):
            resp = self.client.get(self.path)
            self.assertRedirects(resp, "/organizations/new/")

        self.login_as(self.user, superuser=True)

        resp = self.client.get(self.path)

        with self.feature("organizations:create"):
            resp = self.client.get(self.path)
            self.assertRedirects(resp, "/organizations/new/")

    def test_redirect_onboarding(self):
        org = self.create_organization(owner=self.user)
        key = get_client_state_key(org.slug, "onboarding", None)
        get_redis_client().set(key, json.dumps({"state": "started", "url": "select-platform/"}))

        self.client.get(self.path)

        resp = self.client.post(
            self.path, {"username": self.user.username, "password": "admin", "op": "login"}
        )

        assert resp.status_code == 302
        assert resp.get("Location", "").endswith(f"/onboarding/{org.slug}/select-platform/")


@pytest.mark.skipif(
    settings.SENTRY_NEWSLETTER != "sentry.newsletter.dummy.DummyNewsletter",
    reason="Requires DummyNewsletter.",
)
@control_silo_test
class AuthLoginNewsletterTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-login")

    def setUp(self):
        super().setUp()

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


def provision_middleware():
    # TODO: to be removed once CustomerDomainMiddleware is activated.
    middleware = list(settings.MIDDLEWARE)
    if "sentry.middleware.customer_domain.CustomerDomainMiddleware" not in middleware:
        index = middleware.index("sentry.middleware.auth.AuthenticationMiddleware")
        middleware.insert(index + 1, "sentry.middleware.customer_domain.CustomerDomainMiddleware")
    return middleware


@control_silo_test
@override_settings(
    SENTRY_USE_CUSTOMER_DOMAINS=True,
)
class AuthLoginCustomerDomainTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-login")

    def test_login_valid_credentials(self):
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            HTTP_HOST="albertos-apples.testserver",
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [
            (f"http://albertos-apples.testserver{reverse('sentry-login')}", 302),
            ("http://testserver/organizations/new/", 302),
        ]

    def test_login_valid_credentials_with_org(self):
        self.create_organization(name="albertos-apples", owner=self.user)
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            HTTP_HOST="albertos-apples.testserver",
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [
            (f"http://albertos-apples.testserver{reverse('sentry-login')}", 302),
            ("/issues/", 302),
        ]

    def test_login_valid_credentials_invalid_customer_domain(self):
        self.create_organization(name="albertos-apples", owner=self.user)

        with override_settings(MIDDLEWARE=tuple(provision_middleware())):
            # load it once for test cookie
            self.client.get(self.path)
            resp = self.client.post(
                self.path,
                {"username": self.user.username, "password": "admin", "op": "login"},
                # This should preferably be HTTP_HOST.
                # Using SERVER_NAME until https://code.djangoproject.com/ticket/32106 is fixed.
                SERVER_NAME="invalid.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [
                (f"http://invalid.testserver{reverse('sentry-login')}", 302),
                ("http://albertos-apples.testserver/auth/login/", 302),
                ("/issues/", 302),
            ]

    def test_login_valid_credentials_non_staff(self):
        org = self.create_organization(name="albertos-apples")
        non_staff_user = self.create_user(is_staff=False)
        self.create_member(organization=org, user=non_staff_user)
        with override_settings(MIDDLEWARE=tuple(provision_middleware())):
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": non_staff_user.username, "password": "admin", "op": "login"},
                # This should preferably be HTTP_HOST.
                # Using SERVER_NAME until https://code.djangoproject.com/ticket/32106 is fixed.
                SERVER_NAME="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [
                (f"http://albertos-apples.testserver{reverse('sentry-login')}", 302),
                ("/issues/", 302),
            ]

    def test_login_valid_credentials_not_a_member(self):
        user = self.create_user()
        self.create_organization(name="albertos-apples")
        self.create_member(organization=self.organization, user=user)
        with override_settings(MIDDLEWARE=tuple(provision_middleware())):
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": user.username, "password": "admin", "op": "login"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [
                (f"http://albertos-apples.testserver{reverse('sentry-login')}", 302),
                (
                    f"http://albertos-apples.testserver{reverse('sentry-auth-organization', args=['albertos-apples'])}",
                    302,
                ),
            ]

    def test_login_valid_credentials_orgless(self):
        user = self.create_user()
        self.create_organization(name="albertos-apples")
        with override_settings(MIDDLEWARE=tuple(provision_middleware())):
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": user.username, "password": "admin", "op": "login"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [
                (f"http://albertos-apples.testserver{reverse('sentry-login')}", 302),
                ("http://testserver/organizations/new/", 302),
            ]
