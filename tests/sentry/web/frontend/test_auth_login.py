from datetime import timedelta
from functools import cached_property
from unittest import mock
from urllib.parse import quote as urlquote
from urllib.parse import urlencode

import pytest
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from sentry import newsletter
from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.user import User
from sentry.receivers import create_default_projects
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


# TODO(dcramer): need tests for SSO behavior and single org behavior
@control_silo_test
class AuthLoginTest(TestCase, HybridCloudTestMixin):
    @cached_property
    def path(self):
        return reverse("sentry-login")

    def allow_registration(self):
        return self.options({"auth.allow-registration": True})

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

        messages = list(resp.context["messages"])
        assert len(messages) == 1
        assert messages[0].message == "Your session has expired."

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

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_login_ratelimited_ip_gets(self):
        url = reverse("sentry-login")

        with freeze_time("2000-01-01"):
            for _ in range(25):
                self.client.get(url)
            resp = self.client.get(url)
            assert resp.status_code == 429

    def test_login_ratelimited_user(self):
        self.client.get(self.path)
        # Make sure user gets ratelimited
        for i in range(5):
            self.client.post(
                self.path,
                {"username": self.user.username, "password": "wront_password", "op": "login"},
                follow=True,
            )
        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == []
        assert (
            "You have made too many login attempts. Please try again later."
            in resp.content.decode()
        )

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

    @with_feature("organizations:customer-domains")
    def test_login_valid_credentials_with_org_and_customer_domains(self):
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
            (f"http://{org.slug}.testserver/auth/login/", 302),
            (f"http://{org.slug}.testserver/issues/", 302),
        ]

    def test_registration_disabled(self):
        with self.feature({"auth:register": False}), self.allow_registration():
            resp = self.client.get(self.path)
            assert resp.context["register_form"] is None

    @mock.patch("sentry.analytics.record")
    def test_registration_valid(self, mock_record):
        with self.feature("auth:register"), self.allow_registration():
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
        assert marketing_query in resp.headers["Location"]

        user = User.objects.get(username="test-a-really-long-email-address@example.com")
        assert user.email == "test-a-really-long-email-address@example.com"
        assert user.check_password("foobar")
        assert user.name == "Foo Bar"
        with assume_test_silo_mode(SiloMode.REGION):
            assert not OrganizationMember.objects.filter(user_id=user.id).exists()

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
        with assume_test_silo_mode(SiloMode.MONOLITH):
            create_default_projects()
        with self.feature("auth:register"), self.allow_registration():
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
        with assume_test_silo_mode(SiloMode.REGION):
            default_org = Organization.get_default()
            org_member = OrganizationMember.objects.get(
                organization_id=default_org.id, user_id=user.id
            )
        assert org_member.role == default_org.default_role
        self.assert_org_member_mapping(org_member=org_member)

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @mock.patch("sentry.web.frontend.auth_login.ApiInviteHelper.from_session")
    def test_registration_single_org_with_invite(self, from_session):
        with assume_test_silo_mode(SiloMode.MONOLITH):
            create_default_projects()
        self.session["can_register"] = True
        self.save_session()

        self.client.get(self.path)

        invite_helper = mock.Mock(valid_request=True, organization_id=self.organization.id)
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
        with assume_test_silo_mode(SiloMode.REGION):
            assert not OrganizationMember.objects.filter(user_id=user.id).exists()

        # Invitation was accepted
        assert len(invite_helper.accept_invite.mock_calls) == 1
        assert resp.status_code == 302
        assert "/organizations/new/" in resp["Location"]

    def test_register_renders_correct_template(self):
        with self.allow_registration():
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

        invite_helper = mock.Mock(valid_request=True, organization_id=self.organization.id)
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

    def test_register_new_user_accepts_invite_using_session(self):
        invite = self.create_member(
            email="member@example.com",
            token="abcdef",
            token_expires_at=timezone.now() + timedelta(hours=24),
            organization_id=self.organization.id,
        )
        self.session["can_register"] = True
        self.session["invite_token"] = invite.token
        self.session["invite_member_id"] = invite.id
        self.session["invite_organization_id"] = invite.organization_id
        self.save_session()

        self.client.get(self.path)
        resp = self.client.post(
            self.path,
            {
                "username": "member@example.com",
                "password": "foobar",
                "name": "Foo Bar",
                "op": "register",
            },
        )
        assert resp.status_code == 302
        assert f"/organizations/{self.organization.slug}/issues/" in resp["Location"]
        invite.refresh_from_db()
        assert invite.user_id
        assert invite.token is None
        assert User.objects.get(id=invite.user_id).username == "member@example.com"

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

    def test_redirects_authenticated_user_to_custom_next_url(self):
        self.user.update(is_superuser=False)
        self.login_as(self.user)
        resp = self.client.get(self.path + "?next=testserver")
        assert resp.status_code == 302
        assert resp.get("Location", "").endswith("testserver")

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

    @override_settings(
        AUTH_PASSWORD_VALIDATORS=[
            {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"}
        ]
    )
    def test_unable_to_set_weak_password_via_registration_form(self):
        with self.feature("auth:register"), self.options({"auth.allow-registration": True}):
            resp = self.client.post(
                self.path,
                {
                    "username": "hello@example.com",
                    "password": "hello@example.com",
                    "name": "Hello World",
                    "op": "register",
                },
            )
        assert resp.status_code == 200
        assert b"The password is too similar to the username." in resp.content


@pytest.mark.skipif(
    settings.SENTRY_NEWSLETTER != "sentry.newsletter.dummy.DummyNewsletter",
    reason="Requires DummyNewsletter.",
)
@control_silo_test
class AuthLoginNewsletterTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-login")

    def setUp(self):
        super().setUp()

        def disable_newsletter():
            newsletter.backend.disable()

        self.addCleanup(disable_newsletter)
        newsletter.backend.enable()

    def test_registration_requires_subscribe_choice_with_newsletter(self):
        with self.feature("auth:register"), self.options({"auth.allow-registration": True}):
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

        with self.feature("auth:register"), self.options({"auth.allow-registration": True}):
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
        with assume_test_silo_mode(SiloMode.REGION):
            assert not OrganizationMember.objects.filter(user_id=user.id).exists()

        assert newsletter.backend.get_subscriptions(user) == {"subscriptions": []}

    def test_registration_subscribe_to_newsletter(self):
        with self.feature("auth:register"), self.options({"auth.allow-registration": True}):
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

        results = newsletter.backend.get_subscriptions(user)["subscriptions"]
        assert len(results) == 1
        assert results[0].list_id == newsletter.backend.get_default_list_id()
        assert results[0].subscribed
        assert not results[0].verified


@control_silo_test
@override_settings(
    SENTRY_USE_CUSTOMER_DOMAINS=True,
)
class AuthLoginCustomerDomainTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-login")

    def setUp(self):
        super().setUp()

    def disable_registration(self):
        return self.options({"auth.allow-registration": False})

    def test_renders_correct_template_existent_org(self):
        with self.disable_registration():
            resp = self.client.get(
                self.path,
                HTTP_HOST=f"{self.organization.slug}.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [("http://baz.testserver/auth/login/baz/", 302)]
            self.assertTemplateUsed("sentry/organization-login.html")

    def test_renders_correct_template_existent_org_preserve_querystring(self):
        with self.disable_registration():
            resp = self.client.get(
                f"{self.path}?one=two",
                HTTP_HOST=f"{self.organization.slug}.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [("http://baz.testserver/auth/login/baz/?one=two", 302)]
            self.assertTemplateUsed("sentry/organization-login.html")

    def test_renders_correct_template_nonexistent_org(self):
        with self.disable_registration():
            resp = self.client.get(
                self.path,
                HTTP_HOST="does-not-exist.testserver",
            )

            assert resp.status_code == 200
            self.assertTemplateUsed("sentry/login.html")

    def test_login_valid_credentials(self):
        # load it once for test cookie
        with self.disable_registration():
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": self.user.username, "password": "admin", "op": "login"},
                SERVER_NAME="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [
                ("http://albertos-apples.testserver/auth/login/", 302),
                ("http://testserver/organizations/new/", 302),
            ]
            self.assertTemplateUsed("sentry/login.html")

    def test_login_valid_credentials_with_org(self):
        with self.disable_registration():
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
                ("http://albertos-apples.testserver/auth/login/", 302),
                ("http://albertos-apples.testserver/issues/", 302),
            ]

    def test_login_valid_credentials_invalid_customer_domain(self):
        with self.disable_registration():
            self.create_organization(name="albertos-apples", owner=self.user)

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
                ("http://invalid.testserver/auth/login/", 302),
                ("http://albertos-apples.testserver/auth/login/", 302),
                ("http://albertos-apples.testserver/issues/", 302),
            ]

    def test_login_valid_credentials_non_staff(self):
        with self.disable_registration():
            org = self.create_organization(name="albertos-apples")
            non_staff_user = self.create_user(is_staff=False)
            self.create_member(organization=org, user=non_staff_user)

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
                ("http://albertos-apples.testserver/auth/login/", 302),
                ("http://albertos-apples.testserver/issues/", 302),
            ]

    def test_login_valid_credentials_not_a_member(self):
        user = self.create_user()
        self.create_organization(name="albertos-apples")
        self.create_member(organization=self.organization, user=user)
        with self.disable_registration():
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
        with self.disable_registration():
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": user.username, "password": "admin", "op": "login"},
                SERVER_NAME="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [
                ("http://albertos-apples.testserver/auth/login/", 302),
                ("http://albertos-apples.testserver/auth/login/albertos-apples/", 302),
            ]

    def test_login_valid_credentials_org_does_not_exist(self):
        user = self.create_user()
        with self.disable_registration():
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": user.username, "password": "admin", "op": "login"},
                SERVER_NAME="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [
                ("http://albertos-apples.testserver/auth/login/", 302),
                ("http://testserver/organizations/new/", 302),
            ]

    def test_login_redirects_to_sso_org_does_not_exist(self):
        # load it once for test cookie
        with self.disable_registration():
            user = self.create_user()

            self.client.get(self.path)
            user = self.create_user()
            resp = self.client.post(
                self.path,
                {
                    "username": user.username,
                    "password": "admin",
                    "op": "sso",
                    "organization": "foobar",
                },
                SERVER_NAME="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [("/auth/login/", 302)]  # Redirects to default login

    def test_login_redirects_to_sso_provider_does_not_exist(self):
        # load it once for test cookie
        with self.disable_registration():
            user = self.create_user()
            self.create_organization(name="albertos-apples")

            self.client.get(self.path)
            user = self.create_user()
            resp = self.client.post(
                self.path,
                {
                    "username": user.username,
                    "password": "admin",
                    "op": "sso",
                    "organization": "albertos-apples",
                },
                SERVER_NAME="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [
                ("/auth/login/", 302),
                ("http://albertos-apples.testserver/auth/login/albertos-apples/", 302),
            ]  # Redirects to default login

    def test_login_redirects_to_sso_provider(self):
        # load it once for test cookie
        with self.disable_registration():
            user = self.create_user()
            custom_organization = self.create_organization(name="albertos-apples")
            AuthProvider.objects.create(organization_id=custom_organization.id, provider="dummy")
            self.client.get(self.path)
            user = self.create_user()
            resp = self.client.post(
                self.path,
                {
                    "username": user.username,
                    "password": "admin",
                    "op": "sso",
                    "organization": "albertos-apples",
                },
                SERVER_NAME="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [("/auth/login/albertos-apples/", 302)]
