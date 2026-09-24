import re
from datetime import timedelta
from typing import Any
from unittest.mock import ANY, MagicMock, patch
from urllib.parse import urlparse

from django.conf import settings
from django.db import IntegrityError
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient

from sentry import newsletter
from sentry.api.endpoints.auth_register import AuthRegisterEndpoint
from sentry.api.validators.auth import RegistrationValidator
from sentry.auth.authenticators.base import ActivationChallengeResult, ActivationMessageResult
from sentry.auth.authenticators.sms import SmsInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.authenticators.u2f import U2fInterface
from sentry.organizations.services.organization import organization_service
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.users.models.lostpasswordhash import LostPasswordHash
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.utils.auth import SsoSession


@control_silo_test
@override_settings(
    AUTH_PASSWORD_VALIDATORS=[
        {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
        {
            "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
            "OPTIONS": {"min_length": 8},
        },
    ]
)
class RegistrationValidatorTest(TestCase):
    def test_valid_registration_normalizes_email(self) -> None:
        validator = RegistrationValidator(
            data={
                "email": "  New.User@Example.COM  ",
                "name": "New User",
                "password": "a-secure-password",
                "timezone": "Europe/Vienna",
            }
        )

        assert validator.is_valid(), validator.errors
        assert validator.validated_data == {
            "email": "new.user@example.com",
            "name": "New User",
            "password": "a-secure-password",
            "timezone": "Europe/Vienna",
        }

    def test_required_fields(self) -> None:
        validator = RegistrationValidator(data={})

        assert not validator.is_valid()
        assert set(validator.errors) == {"email", "name", "password"}

    def test_invalid_email(self) -> None:
        validator = RegistrationValidator(
            data={"email": "not-an-email", "name": "New User", "password": "a-secure-password"}
        )

        assert not validator.is_valid()
        assert "email" in validator.errors

    def test_rejects_fields_exceeding_form_limits(self) -> None:
        validator = RegistrationValidator(
            data={
                "email": f"{'a' * 117}@example.com",
                "name": "A" * 201,
                "password": "a-secure-password",
            }
        )

        assert not validator.is_valid()
        assert set(validator.errors) == {"email", "name"}

    @override_settings(INVALID_EMAIL_ADDRESS_PATTERN=re.compile(r"@example\.com$"))
    def test_disallowed_email_domain(self) -> None:
        validator = RegistrationValidator(
            data={
                "email": "new.user@example.com",
                "name": "New User",
                "password": "a-secure-password",
            }
        )

        assert not validator.is_valid()
        assert validator.errors["email"] == ["Enter a valid email address."]

    def test_existing_email_is_case_insensitive(self) -> None:
        self.create_user(email="registered@example.com")
        validator = RegistrationValidator(
            data={
                "email": "REGISTERED@EXAMPLE.COM",
                "name": "New User",
                "password": "a-secure-password",
            }
        )

        assert not validator.is_valid()
        assert validator.errors["email"] == [
            "An account is already registered with that email address."
        ]

    def test_existing_primary_email_is_rejected(self) -> None:
        self.create_user(username="legacy-username", email="registered@example.com")
        validator = RegistrationValidator(
            data={
                "email": "REGISTERED@EXAMPLE.COM",
                "name": "New User",
                "password": "a-secure-password",
            }
        )

        assert not validator.is_valid()
        assert validator.errors["email"] == [
            "An account is already registered with that email address."
        ]

    def test_existing_unique_email_is_rejected(self) -> None:
        self.create_user(
            username="legacy-username",
            email="legacy@example.com",
            email_unique="registered@example.com",
        )
        validator = RegistrationValidator(
            data={
                "email": "REGISTERED@EXAMPLE.COM",
                "name": "New User",
                "password": "a-secure-password",
            }
        )

        assert not validator.is_valid()
        assert validator.errors["email"] == [
            "An account is already registered with that email address."
        ]

    def test_password_uses_email_for_similarity_validation(self) -> None:
        validator = RegistrationValidator(
            data={
                "email": "new.user@example.com",
                "name": "New User",
                "password": "new.user@example.com",
            }
        )

        assert not validator.is_valid()
        assert validator.errors["password"] == ["The password is too similar to the email address."]

    def test_password_preserves_whitespace(self) -> None:
        validator = RegistrationValidator(
            data={
                "email": "new.user@example.com",
                "name": "New User",
                "password": "  a-secure-password  ",
            }
        )

        assert validator.is_valid(), validator.errors
        assert validator.validated_data["password"] == "  a-secure-password  "

    def test_newsletter_requires_explicit_consent_choice(self) -> None:
        with patch("sentry.api.validators.auth.newsletter.backend.is_enabled", return_value=True):
            validator = RegistrationValidator(
                data={
                    "email": "new.user@example.com",
                    "name": "New User",
                    "password": "a-secure-password",
                }
            )

        assert not validator.is_valid()
        assert "subscribe" in validator.errors

    def test_newsletter_accepts_declined_consent(self) -> None:
        with patch("sentry.api.validators.auth.newsletter.backend.is_enabled", return_value=True):
            validator = RegistrationValidator(
                data={
                    "email": "new.user@example.com",
                    "name": "New User",
                    "password": "a-secure-password",
                    "subscribe": False,
                }
            )

        assert validator.is_valid(), validator.errors
        assert validator.validated_data["subscribe"] is False

    def test_newsletter_rejects_invalid_consent(self) -> None:
        with patch("sentry.api.validators.auth.newsletter.backend.is_enabled", return_value=True):
            validator = RegistrationValidator(
                data={
                    "email": "new.user@example.com",
                    "name": "New User",
                    "password": "a-secure-password",
                    "subscribe": "maybe",
                }
            )

        assert not validator.is_valid()
        assert "subscribe" in validator.errors

    def test_rejects_unknown_timezone(self) -> None:
        validator = RegistrationValidator(
            data={
                "email": "new.user@example.com",
                "name": "New User",
                "password": "a-secure-password",
                "timezone": "Middle Earth/Shire",
            }
        )

        assert not validator.is_valid()
        assert "timezone" in validator.errors


@control_silo_test
@override_settings(
    AUTH_PASSWORD_VALIDATORS=[
        {
            "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
            "OPTIONS": {"min_length": 8},
        }
    ]
)
class AuthRegisterEndpointTest(APITestCase):
    endpoint = "sentry-api-0-auth-register"
    method = "post"

    def register(self, **data: Any) -> Response:
        with self.feature("auth:register"), self.options({"auth.allow-registration": True}):
            return self.get_response(**data)

    def test_requires_csrf_token(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)

        response = self.register(
            email="new.user@example.com",
            name="New User",
            password="a-secure-password",
        )

        assert response.status_code == 403
        assert not User.objects.filter(username="new.user@example.com").exists()

    @patch.object(User, "send_confirm_emails")
    def test_accepts_valid_csrf_token(self, send_confirm_emails: MagicMock) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        csrf_token = "a" * 32
        self.client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token

        response = self.register(
            email="new.user@example.com",
            name="New User",
            password="a-secure-password",
            extra_headers={"HTTP_X_CSRFTOKEN": csrf_token},
        )

        assert response.status_code == 200
        assert User.objects.filter(username="new.user@example.com").exists()

    @patch.object(User, "send_confirm_emails")
    @patch("sentry.api.endpoints.auth_register.user_signup.send_robust")
    def test_registers_and_authenticates_user(
        self, send_signup: MagicMock, send_confirm_emails: MagicMock
    ) -> None:
        response = self.register(
            email="NEW.USER@EXAMPLE.COM",
            name="New User",
            password="a-secure-password",
            timezone="Europe/Vienna",
        )

        assert response.status_code == 200
        user = User.objects.get(username="new.user@example.com")
        assert user.email == "new.user@example.com"
        assert user.email_unique == "new.user@example.com"
        assert user.name == "New User"
        assert user.check_password("a-secure-password")
        assert UserOption.objects.get(user=user, key="timezone").value == "Europe/Vienna"
        assert self.client.session["_auth_user_id"] == str(user.id)
        assert response.data["user"]["id"] == str(user.id)

        next_uri = urlparse(response.data["nextUri"])
        assert next_uri.path == "/organizations/new/"
        assert next_uri.query == ""

        send_confirm_emails.assert_called_once_with(is_new_user=True)
        send_signup.assert_called_once_with(
            sender=ANY,
            user=user,
            source="api",
            referrer="in-app",
        )
        assert isinstance(send_signup.call_args.kwargs["sender"], AuthRegisterEndpoint)

    def test_requires_registration_access(self) -> None:
        with (
            self.feature({"auth:register": False}),
            self.options({"auth.allow-registration": False}),
        ):
            response = self.get_response(
                email="new.user@example.com",
                name="New User",
                password="a-secure-password",
            )

        assert response.status_code == 403
        assert response.data == {"detail": "Registration is not available"}
        assert not User.objects.filter(username="new.user@example.com").exists()

    def test_rejects_authenticated_user(self) -> None:
        self.login_as(self.user)

        response = self.register(
            email="new.user@example.com",
            name="New User",
            password="a-secure-password",
        )

        assert response.status_code == 409
        assert response.data == {"detail": "Cannot register while authenticated"}
        assert not User.objects.filter(username="new.user@example.com").exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    @patch.object(User, "send_confirm_emails")
    def test_rate_limits_registrations_by_ip(self, send_confirm_emails: MagicMock) -> None:
        request_headers = {"REMOTE_ADDR": "192.0.2.1"}

        with freeze_time("2000-01-01"):
            for index in range(10):
                response = self.register(
                    email=f"new.user{index}@example.com",
                    name="New User",
                    password="a-secure-password",
                    extra_headers=request_headers,
                )
                assert response.status_code == 200
                self.client.logout()

            response = self.register(
                email="blocked.user@example.com",
                name="Blocked User",
                password="a-secure-password",
                extra_headers=request_headers,
            )

        assert response.status_code == 429
        assert not User.objects.filter(username="blocked.user@example.com").exists()
        assert send_confirm_emails.call_count == 10

    @patch.object(User, "send_confirm_emails")
    def test_session_registration_access_is_consumed(self, send_confirm_emails: MagicMock) -> None:
        self.session["can_register"] = True
        self.session["invite_email"] = "new.user@example.com"
        self.save_session()

        with (
            self.feature({"auth:register": False}),
            self.options({"auth.allow-registration": False}),
        ):
            response = self.get_response(
                email="new.user@example.com",
                name="New User",
                password="a-secure-password",
            )

        assert response.status_code == 200
        assert "can_register" not in self.client.session
        assert "invite_email" not in self.client.session

    @patch.object(User, "send_confirm_emails")
    def test_subscribes_with_explicit_consent(self, send_confirm_emails: MagicMock) -> None:
        with (
            patch("sentry.api.validators.auth.newsletter.backend.is_enabled", return_value=True),
            patch(
                "sentry.api.endpoints.auth_register.newsletter.backend.create_or_update_subscriptions"
            ) as subscribe,
        ):
            response = self.register(
                email="new.user@example.com",
                name="New User",
                password="a-secure-password",
                subscribe=True,
            )

        assert response.status_code == 200
        user = User.objects.get(username="new.user@example.com")
        subscribe.assert_called_once_with(user, list_ids=newsletter.backend.get_default_list_ids())

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @patch.object(User, "send_confirm_emails")
    def test_adds_user_to_single_organization(self, send_confirm_emails: MagicMock) -> None:
        organization = self.create_organization(slug="single-org")

        response = self.register(
            email="new.user@example.com",
            name="New User",
            password="a-secure-password",
        )

        assert response.status_code == 200
        user = User.objects.get(username="new.user@example.com")
        member = organization_service.check_membership_by_id(
            organization_id=organization.id, user_id=user.id
        )
        assert member is not None
        assert member.role == organization.default_role
        assert self.client.session["activeorg"] == organization.slug
        assert urlparse(response.data["nextUri"]).path == (
            f"/organizations/{organization.slug}/issues/"
        )

    @patch.object(User, "send_confirm_emails")
    def test_accepts_pending_invite(self, send_confirm_emails: MagicMock) -> None:
        organization = self.create_organization(slug="invited-org")
        invite = self.create_member(
            email="new.user@example.com",
            token="abcdef",
            token_expires_at=timezone.now() + timedelta(hours=24),
            organization_id=organization.id,
        )
        self.session["can_register"] = True
        self.session["invite_token"] = invite.token
        self.session["invite_member_id"] = invite.id
        self.session["invite_organization_id"] = invite.organization_id
        self.save_session()

        response = self.get_response(
            email="new.user@example.com",
            name="New User",
            password="a-secure-password",
        )

        assert response.status_code == 200
        user = User.objects.get(username="new.user@example.com")
        invite.refresh_from_db()
        assert invite.user_id == user.id
        assert invite.token is None
        assert self.client.session["activeorg"] == organization.slug
        assert "invite_token" not in self.client.session
        assert "invite_member_id" not in self.client.session
        assert "invite_organization_id" not in self.client.session
        assert urlparse(response.data["nextUri"]).path == (
            f"/organizations/{organization.slug}/issues/"
        )

    def test_duplicate_created_during_registration_returns_validation_error(self) -> None:
        with (
            patch.object(RegistrationValidator, "validate_email", return_value="new@example.com"),
            patch.object(User, "save", side_effect=IntegrityError),
            patch("sentry.api.endpoints.auth_register.User.objects.filter") as user_filter,
        ):
            user_filter.return_value.exists.return_value = True
            response = self.register(
                email="new@example.com",
                name="New User",
                password="a-secure-password",
            )

        assert response.status_code == 400
        assert response.data["email"] == [
            "An account is already registered with that email address."
        ]


@control_silo_test
class AuthDemoLoginEndpointTest(APITestCase):
    endpoint = "sentry-api-0-auth-demo-login"
    method = "post"

    def test_requires_csrf_token(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)

        with override_options({"demo-mode.enabled": True}):
            response = self.get_response("demo")

        assert response.status_code == 403

    def test_login_validates_destination(self) -> None:
        with override_options({"demo-mode.enabled": True}):
            self.get_error_response("demo", nextUri=[], status_code=400)

        assert "_auth_user_id" not in self.client.session

    def test_disabled_demo_mode_precedes_validation(self) -> None:
        with override_options({"demo-mode.enabled": False}):
            self.get_error_response("demo", nextUri=[], status_code=404)

        assert "_auth_user_id" not in self.client.session

    def test_login_requires_existing_organization(self) -> None:
        with override_options({"demo-mode.enabled": True}):
            self.get_error_response("does-not-exist", status_code=404)

        assert "_auth_user_id" not in self.client.session

    def test_login_demo_user(self) -> None:
        demo_user = self.create_user()
        demo_organization = self.create_organization(owner=demo_user, slug="demo")

        with override_options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [demo_user.id],
                "demo-mode.orgs": [demo_organization.id],
            }
        ):
            response = self.get_success_response(demo_organization.slug)

        assert response.data["nextUri"] == (f"/organizations/{demo_organization.slug}/issues/")
        assert response.data["user"]["id"] == str(demo_user.id)
        assert self.client.session["_auth_user_id"] == str(demo_user.id)
        assert self.client.session["activeorg"] == demo_organization.slug

    def test_login_requires_mfa(self) -> None:
        demo_user = self.create_user()
        demo_organization = self.create_organization(owner=demo_user, slug="demo")
        TotpInterface().enroll(demo_user)

        with override_options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [demo_user.id],
                "demo-mode.orgs": [demo_organization.id],
            }
        ):
            response = self.get_success_response(
                demo_organization.slug,
                nextUri="/settings/account/",
                status_code=202,
            )

        assert response.data == {"mfaRequired": True, "mfaMethods": [{"id": "totp"}]}
        assert "_auth_user_id" not in self.client.session
        assert self.client.session["_pending_2fa"][0] == demo_user.id
        assert self.client.session["_next"] == "/settings/account/"

    def test_login_requires_demo_mode(self) -> None:
        demo_user = self.create_user()
        demo_organization = self.create_organization(owner=demo_user, slug="demo")

        with override_options(
            {
                "demo-mode.enabled": False,
                "demo-mode.users": [demo_user.id],
                "demo-mode.orgs": [demo_organization.id],
            }
        ):
            self.get_error_response(demo_organization.slug, status_code=404)

        assert "_auth_user_id" not in self.client.session

    def test_login_uses_requested_destination(self) -> None:
        demo_user = self.create_user()
        demo_organization = self.create_organization(owner=demo_user, slug="demo")

        with override_options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [demo_user.id],
                "demo-mode.orgs": [demo_organization.id],
            }
        ):
            response = self.get_success_response(
                demo_organization.slug, nextUri="/settings/account/"
            )

        assert response.data["nextUri"] == "/settings/account/"

    def test_login_rejects_external_destination(self) -> None:
        demo_user = self.create_user()
        demo_organization = self.create_organization(owner=demo_user, slug="demo")

        with override_options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [demo_user.id],
                "demo-mode.orgs": [demo_organization.id],
            }
        ):
            response = self.get_success_response(
                demo_organization.slug, nextUri="https://example.com/"
            )

        assert response.data["nextUri"] == (f"/organizations/{demo_organization.slug}/issues/")

    def test_login_requires_demo_organization(self) -> None:
        demo_user = self.create_user()
        demo_organization = self.create_organization(owner=demo_user, slug="demo")
        other_organization = self.create_organization(slug="other")

        with override_options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [demo_user.id],
                "demo-mode.orgs": [demo_organization.id],
            }
        ):
            self.get_error_response(other_organization.slug, status_code=404)

        assert "_auth_user_id" not in self.client.session


@control_silo_test
class AuthLoginEndpointTest(APITestCase):
    endpoint = "sentry-api-0-auth-login"
    method = "post"

    def setUp(self) -> None:
        # Requests to set the test cookie
        self.client.get(reverse("sentry-api-0-auth-config"))

    def test_requires_csrf_token(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.get(reverse("sentry-api-0-auth-config"))

        response = self.get_response(username=self.user.username, password="admin")

        assert response.status_code == 403
        assert "_auth_user_id" not in self.client.session

    def test_accepts_valid_csrf_token(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.get(reverse("sentry-api-0-auth-config"))
        csrf_token = "a" * 32
        self.client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token

        response = self.get_response(
            username=self.user.username,
            password="admin",
            extra_headers={"HTTP_X_CSRFTOKEN": csrf_token},
        )

        assert response.status_code == 200
        assert self.client.session["_auth_user_id"] == str(self.user.id)

    def test_login_invalid_password(self) -> None:
        response = self.get_error_response(
            username=self.user.username, password="bizbar", status_code=400
        )
        assert response.data["errors"]["__all__"] == [
            "Please enter a correct username and password. Note that both fields may be case-sensitive."
        ]

    def test_login_valid_credentials(self) -> None:
        response = self.get_success_response(username=self.user.username, password="admin")
        assert response.data["nextUri"] == "/organizations/new/"

    def test_login_valid_credentials_with_organization(self) -> None:
        organization = self.create_organization(owner=self.user)

        response = self.get_success_response(username=self.user.username, password="admin")

        assert response.data["nextUri"] == f"/organizations/{organization.slug}/issues/"
        assert self.client.session["activeorg"] == organization.slug

    def test_login_valid_credentials_with_requested_organization(self) -> None:
        self.create_organization(owner=self.user, slug="org-a")
        requested_organization = self.create_organization(owner=self.user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug=requested_organization.slug,
        )

        assert response.data["nextUri"] == f"/organizations/{requested_organization.slug}/issues/"
        assert self.client.session["activeorg"] == requested_organization.slug

    def test_login_valid_credentials_with_snake_case_organization(self) -> None:
        self.create_organization(owner=self.user, slug="org-a")
        requested_organization = self.create_organization(owner=self.user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            org_slug=requested_organization.slug,
        )

        assert response.data["nextUri"] == f"/organizations/{requested_organization.slug}/issues/"
        assert self.client.session["activeorg"] == requested_organization.slug

    def test_login_with_unknown_requested_organization_uses_default(self) -> None:
        default_organization = self.create_organization(owner=self.user, slug="org-a")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug="missing-org",
        )

        assert response.data["nextUri"] == f"/organizations/{default_organization.slug}/issues/"
        assert self.client.session["activeorg"] == default_organization.slug

    def test_login_with_unauthorized_requested_organization_uses_default(self) -> None:
        self.user.update(is_superuser=False)
        default_organization = self.create_organization(owner=self.user, slug="org-a")
        other_user = self.create_user("other@example.com")
        self.create_organization(owner=other_user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug="org-b",
        )

        assert response.data["nextUri"] == f"/organizations/{default_organization.slug}/issues/"
        assert self.client.session["activeorg"] == default_organization.slug

    def test_password_login_cannot_select_sso_required_organization(self) -> None:
        user = self.create_user(email="member@example.com")
        user.set_password("password")
        user.save()
        organization = self.create_organization(slug="sso-org")
        self.create_member(organization=organization, user=user)
        self.create_auth_provider(organization_id=organization.id, provider="dummy")

        response = self.get_success_response(
            username=user.username,
            password="password",
            orgSlug=organization.slug,
        )

        assert response.data["nextUri"] == reverse("sentry-account-settings")
        assert "activeorg" not in self.client.session
        assert SsoSession.django_session_key(organization.id) not in self.client.session

    def test_password_login_falls_back_from_sso_required_organization(self) -> None:
        user = self.create_user(email="member@example.com")
        user.set_password("password")
        user.save()
        sso_organization = self.create_organization(slug="sso-org")
        self.create_member(organization=sso_organization, user=user)
        self.create_auth_provider(organization_id=sso_organization.id, provider="dummy")
        password_organization = self.create_organization(owner=user, slug="password-org")

        response = self.get_success_response(
            username=user.username,
            password="password",
            orgSlug=sso_organization.slug,
        )

        assert response.data["nextUri"] == (f"/organizations/{password_organization.slug}/issues/")
        assert self.client.session["activeorg"] == password_organization.slug
        assert SsoSession.django_session_key(sso_organization.id) not in self.client.session

    def test_login_requires_mfa(self) -> None:
        TotpInterface().enroll(self.user)

        response = self.get_response(username=self.user.username, password="admin")

        assert response.status_code == 202
        assert response.data == {
            "mfaRequired": True,
            "mfaMethods": [{"id": "totp"}],
        }
        assert "_auth_user_id" not in self.client.session
        assert self.client.session["_pending_2fa"][0] == self.user.id

    def test_get_mfa_methods(self) -> None:
        TotpInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.get(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 200
        assert response.data == {
            "mfaRequired": True,
            "mfaMethods": [{"id": "totp"}],
        }

    def test_get_mfa_methods_requires_pending_login(self) -> None:
        response = self.client.get(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 404
        assert response.data == {"detail": "No two-factor authentication request is active"}

    def test_complete_mfa_login(self) -> None:
        interface = TotpInterface()
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        with patch.object(interface.__class__, "validate_otp", return_value=True):
            response = self.client.post(
                reverse("sentry-api-0-auth-2fa"),
                data={"method": "totp", "otp": "123456"},
            )

        assert response.status_code == 200
        assert response.data["nextUri"] == "/organizations/new/"
        assert response.data["user"]["id"] == str(self.user.id)
        assert self.client.session["_auth_user_id"] == str(self.user.id)
        assert "_pending_2fa" not in self.client.session

    def test_complete_mfa_login_requires_csrf_token(self) -> None:
        TotpInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        pending_client = self.client
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.cookies.update(pending_client.cookies)

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={"method": "totp", "otp": "123456"},
        )

        assert response.status_code == 403

    def test_complete_mfa_login_requires_pending_login(self) -> None:
        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={"method": "totp", "otp": "123456"},
        )

        assert response.status_code == 401
        assert response.data == {"detail": "No pending two-factor authentication"}

    def test_complete_mfa_login_rejects_invalid_code(self) -> None:
        interface = TotpInterface()
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        with patch.object(interface.__class__, "validate_otp", return_value=False):
            response = self.client.post(
                reverse("sentry-api-0-auth-2fa"),
                data={"method": "totp", "otp": "invalid"},
            )

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid two-factor authentication credentials"}
        assert "_auth_user_id" not in self.client.session

    @patch("sentry.api.endpoints.auth_2fa.send_2fa_rate_limit_notification")
    @patch("sentry.api.endpoints.auth_2fa.is_2fa_rate_limited", return_value=True)
    def test_complete_mfa_login_rate_limited(
        self, is_rate_limited: MagicMock, send_notification: MagicMock
    ) -> None:
        TotpInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={"method": "totp", "otp": "123456"},
        )

        assert response.status_code == 429
        assert response.data == {"detail": "Too many two-factor authentication attempts"}
        is_rate_limited.assert_called_once_with(self.user.id)
        send_notification.assert_called_once_with(
            user_id=self.user.id,
            email=self.user.username,
            ip_address="127.0.0.1",
        )

    def test_complete_mfa_login_rejects_expired_password(self) -> None:
        interface = TotpInterface()
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        self.user.update(is_password_expired=True)

        with patch.object(interface.__class__, "validate_otp", return_value=True):
            response = self.client.post(
                reverse("sentry-api-0-auth-2fa"),
                data={"method": "totp", "otp": "123456"},
            )

        assert response.status_code == 403
        assert response.data == {
            "detail": "Cannot complete authentication because the password has expired"
        }
        assert "_pending_2fa" not in self.client.session
        assert "_auth_user_id" not in self.client.session
        assert "mfa" not in self.client.session

        self.user.refresh_from_db()
        self.user.set_password("new-password")
        self.user.save()

        response = self.get_response(username=self.user.username, password="new-password")

        assert response.status_code == 202
        assert self.client.session["_pending_2fa"][0] == self.user.id

    def test_cancel_mfa_login(self) -> None:
        TotpInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        session = self.client.session
        session["_after_2fa"] = "/after-2fa/"
        session["_next"] = "/settings/account/"
        session.save()
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key or ""
        assert self.client.session["_next"] == "/settings/account/"

        response = self.client.delete(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 204
        assert "_pending_2fa" not in self.client.session
        assert "_after_2fa" not in self.client.session
        assert self.client.session["_next"] == "/settings/account/"

    def test_cancel_mfa_login_is_idempotent(self) -> None:
        response = self.client.delete(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 204

    def test_cancel_mfa_login_clears_webauthn_challenge(self) -> None:
        session = self.client.session
        session["webauthn_authentication_state"] = "state"
        session.save()
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key or ""
        assert self.client.session["webauthn_authentication_state"] == "state"

        response = self.client.delete(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 204
        assert "webauthn_authentication_state" not in self.client.session

    @patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    @patch(
        "sentry.auth.authenticators.U2fInterface.activate",
        return_value=ActivationChallengeResult(b"challenge"),
    )
    def test_activate_webauthn_challenge(self, activate, is_available) -> None:
        U2fInterface().enroll(self.user)
        login_response = self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "u2f"},
        )

        assert login_response.data["mfaMethods"] == [{"id": "u2f"}]
        assert response.status_code == 200
        assert response.data == {
            "method": "u2f",
            # Base64-encoded form of the mocked b"challenge" activation payload.
            "challenge": {"webAuthnAuthenticationData": "Y2hhbGxlbmdl"},
        }
        activate.assert_called_once()

    def test_activate_challenge_requires_csrf_token(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "totp"},
        )

        assert response.status_code == 403

    @patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    @patch("sentry.auth.authenticators.U2fInterface.validate_response", return_value=True)
    def test_complete_webauthn_login(self, validate_response, is_available) -> None:
        U2fInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        webauthn_response = {
            "keyHandle": "key-handle",
            "clientData": "client-data",
            "authenticatorData": "authenticator-data",
            "signatureData": "signature-data",
        }

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={"method": "u2f", "response": webauthn_response},
            content_type="application/json",
        )

        assert response.status_code == 200
        assert response.data["user"]["id"] == str(self.user.id)
        assert self.client.session["_auth_user_id"] == str(self.user.id)
        validate_response.assert_called_once_with(
            ANY,
            None,
            {
                "keyHandle": "key-handle",
                "clientData": "client-data",
                "authenticatorData": "authenticator-data",
                "signatureData": "signature-data",
            },
        )

    @patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    def test_complete_webauthn_login_rejects_malformed_response(self, is_available) -> None:
        U2fInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        session = self.client.session
        session["webauthn_authentication_state"] = "state"
        session.save()

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={
                "method": "u2f",
                "response": {
                    "keyHandle": "a",
                    "clientData": "a",
                    "authenticatorData": "a",
                    "signatureData": "a",
                },
            },
            content_type="application/json",
        )

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid two-factor authentication credentials"}
        assert "_auth_user_id" not in self.client.session

    @patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    def test_complete_webauthn_login_uses_camel_case_validation_errors(self, is_available) -> None:
        U2fInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={
                "method": "u2f",
                "response": {
                    "keyHandle": "key-handle",
                    "clientData": "client-data",
                    "authenticatorData": "authenticator-data",
                },
            },
            content_type="application/json",
        )

        assert response.status_code == 400
        assert "signatureData" in response.data["response"]

    @patch("sentry.auth.authenticators.SmsInterface.is_available", return_value=True)
    @patch(
        "sentry.auth.authenticators.SmsInterface.activate",
        return_value=ActivationMessageResult("Code sent", expires_in=45),
    )
    def test_activate_sms_challenge(self, activate, is_available) -> None:
        interface = SmsInterface()
        interface.phone_number = "5555551212"
        interface.enroll(self.user)
        login_response = self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "sms"},
        )

        assert login_response.data["mfaMethods"] == [{"id": "sms"}]
        assert response.status_code == 200
        assert response.data == {"method": "sms", "expiresIn": 45}
        activate.assert_called_once()

    @patch("sentry.api.endpoints.auth_2fa.sentry_sdk.capture_message")
    @patch("sentry.auth.authenticators.SmsInterface.is_available", return_value=True)
    @patch(
        "sentry.auth.authenticators.SmsInterface.activate",
        return_value=ActivationMessageResult("Unable to send code", type="error"),
    )
    def test_activate_challenge_captures_provider_error(
        self, activate, is_available, capture_message
    ) -> None:
        interface = SmsInterface()
        interface.phone_number = "5555551212"
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "sms"},
        )

        assert response.status_code == 503
        assert response.data == {"detail": "Unable to activate authentication challenge"}
        capture_message.assert_called_once_with(
            "Two-factor authentication challenge activation failed",
            level="error",
            extras={"method": "sms"},
        )

    @patch("sentry.api.endpoints.auth_2fa.sentry_sdk.capture_message")
    @patch("sentry.auth.authenticators.SmsInterface.is_available", return_value=True)
    @patch("sentry.auth.authenticators.SmsInterface.activate", return_value=None)
    def test_activate_challenge_captures_unexpected_result(
        self, activate, is_available, capture_message
    ) -> None:
        interface = SmsInterface()
        interface.phone_number = "5555551212"
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "sms"},
        )

        assert response.status_code == 500
        assert response.data == {"detail": "Unable to activate authentication challenge"}
        capture_message.assert_called_once_with(
            "Unexpected two-factor authentication challenge activation result",
            level="error",
            extras={"activation_type": "NoneType", "method": "sms"},
        )

    @patch("sentry.api.endpoints.auth_2fa.sentry_sdk.capture_exception")
    @patch("sentry.auth.authenticators.SmsInterface.is_available", return_value=True)
    @patch(
        "sentry.auth.authenticators.SmsInterface.activate",
        return_value=ActivationMessageResult("Code sent"),
    )
    def test_activate_challenge_captures_unsupported_result(
        self, activate, is_available, capture_exception
    ) -> None:
        interface = SmsInterface()
        interface.phone_number = "5555551212"
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "sms"},
        )

        assert response.status_code == 500
        assert response.data == {"detail": "Unable to activate authentication challenge"}
        capture_exception.assert_called_once()

    def test_must_reactivate(self) -> None:
        self.user.update(is_active=False)

        response = self.get_success_response(username=self.user.username, password="admin")
        assert response.data["nextUri"] == "/auth/reactivate/"

    def test_login_suspended_user(self) -> None:
        self.user.update(is_suspended=True)

        response = self.get_error_response(
            username=self.user.username, password="admin", status_code=400
        )
        assert "Your account has been suspended." in str(response.data["errors"])

    @patch(
        "sentry.api.endpoints.auth_login.ratelimiter.backend.is_limited",
        autospec=True,
        return_value=True,
    )
    def test_login_ratelimit(self, is_limited: MagicMock) -> None:
        response = self.get_error_response(
            username=self.user.username, password="admin", status_code=400
        )
        assert [str(s) for s in response.data["errors"]["__all__"]] == [
            "You have made too many failed authentication attempts. Please try again later."
        ]


@control_silo_test
class AuthRecoveryEndpointTest(APITestCase):
    def request_recovery(
        self, user: str | None = None, client: APIClient | None = None
    ) -> Response:
        return (client or self.client).post(
            reverse("sentry-api-0-auth-recovery"),
            data={"user": user or self.user.email},
        )

    def confirm_recovery(
        self,
        token: str,
        password: str = "new-secure-password",
        client: APIClient | None = None,
    ) -> Response:
        return (client or self.client).post(
            reverse("sentry-api-0-auth-recovery-confirm"),
            data={"userId": self.user.id, "token": token, "password": password},
        )

    def test_request_recovery_requires_csrf_token(self) -> None:
        client = APIClient(enforce_csrf_checks=True)

        response = self.request_recovery(client=client)

        assert response.status_code == 403
        assert not LostPasswordHash.objects.exists()

    def test_confirm_recovery_requires_csrf_token(self) -> None:
        client = APIClient(enforce_csrf_checks=True)

        response = self.confirm_recovery("recovery-token", client=client)

        assert response.status_code == 403

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_request_recovery(self, send_recovery_email: MagicMock) -> None:
        response = self.request_recovery()

        assert response.status_code == 202
        assert response.data == {
            "detail": "If an eligible account exists, a recovery email has been sent."
        }
        password_hash = LostPasswordHash.objects.get(user=self.user)
        send_recovery_email.assert_called_once_with(self.user, password_hash.hash, "127.0.0.1")

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_request_recovery_does_not_reveal_account_status(
        self, send_recovery_email: MagicMock
    ) -> None:
        unknown_response = self.request_recovery("unknown@example.com")
        self.user.update(is_suspended=True)
        suspended_response = self.request_recovery()

        assert unknown_response.status_code == 202
        assert suspended_response.status_code == 202
        assert unknown_response.data == suspended_response.data
        assert not LostPasswordHash.objects.exists()
        send_recovery_email.assert_not_called()

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_request_recovery_does_not_send_for_managed_account(
        self, send_recovery_email: MagicMock
    ) -> None:
        self.user.update(is_managed=True)

        response = self.request_recovery()

        assert response.status_code == 202
        assert not LostPasswordHash.objects.exists()
        send_recovery_email.assert_not_called()

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_request_recovery_does_not_send_for_ambiguous_email(
        self, send_recovery_email: MagicMock
    ) -> None:
        """Do not choose an account when legacy duplicate primary emails are ambiguous."""
        shared_email = "shared@example.com"
        self.user.update(email=shared_email)
        other_user = self.create_user(email="other@example.com")
        other_user.update(email=shared_email)

        response = self.request_recovery(shared_email)

        assert response.status_code == 202
        assert not LostPasswordHash.objects.exists()
        send_recovery_email.assert_not_called()

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_request_recovery_rotates_expired_token(self, send_recovery_email: MagicMock) -> None:
        self.request_recovery()
        password_hash = LostPasswordHash.objects.get(user=self.user)
        expired_token = password_hash.hash
        password_hash.update(date_added=timezone.now() - timedelta(hours=2))

        response = self.request_recovery()

        assert response.status_code == 202
        password_hash.refresh_from_db()
        assert password_hash.hash != expired_token
        assert send_recovery_email.call_count == 2
        assert send_recovery_email.call_args.args[1] == password_hash.hash

    @patch(
        "sentry.api.endpoints.auth_recovery.ratelimiter.backend.is_limited",
        return_value=True,
    )
    def test_request_recovery_rate_limited(self, is_limited: MagicMock) -> None:
        response = self.client.post(reverse("sentry-api-0-auth-recovery"), data={})

        assert response.status_code == 429
        assert response.data == {"detail": "Too many password recovery attempts"}

    @patch("sentry.api.endpoints.auth_recovery.capture_security_activity")
    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_confirm_recovery_changes_password_without_login(
        self, send_recovery_email: MagicMock, capture_security_activity: MagicMock
    ) -> None:
        previous_nonce = self.user.session_nonce
        user_email = UserEmail.objects.get(user=self.user, email=self.user.email)
        user_email.update(is_verified=False)
        self.request_recovery()
        password_hash = LostPasswordHash.objects.get(user=self.user)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.confirm_recovery(password_hash.hash)

        assert response.status_code == 204
        assert response.content == b""
        assert "_auth_user_id" not in self.client.session
        assert not LostPasswordHash.objects.filter(user=self.user).exists()
        self.user.refresh_from_db()
        user_email.refresh_from_db()
        assert self.user.check_password("new-secure-password")
        assert self.user.session_nonce != previous_nonce
        assert user_email.is_verified
        capture_security_activity.assert_called_once_with(
            account=self.user,
            type="password-changed",
            actor=self.user,
            ip_address="127.0.0.1",
            send_email=True,
        )

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_confirm_recovery_invalidates_existing_session(
        self, send_recovery_email: MagicMock
    ) -> None:
        self.login_as(self.user)
        assert self.client.get(reverse("sentry-api-0-auth")).status_code == 200
        recovery_client = APIClient()
        self.request_recovery(client=recovery_client)
        password_hash = LostPasswordHash.objects.get(user=self.user)

        response = self.confirm_recovery(password_hash.hash, client=recovery_client)

        assert response.status_code == 204
        assert self.client.get(reverse("sentry-api-0-auth")).status_code == 400

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_confirm_recovery_token_cannot_be_replayed(
        self, send_recovery_email: MagicMock
    ) -> None:
        self.request_recovery()
        password_hash = LostPasswordHash.objects.get(user=self.user)

        first_response = self.confirm_recovery(password_hash.hash)
        second_response = self.confirm_recovery(password_hash.hash, "another-secure-password")

        assert first_response.status_code == 204
        assert second_response.status_code == 400
        assert second_response.data == {"detail": "Invalid or expired recovery token"}
        self.user.refresh_from_db()
        assert self.user.check_password("new-secure-password")

    def test_confirm_recovery_rejects_invalid_token(self) -> None:
        previous_password = self.user.password

        response = self.confirm_recovery("invalid-token")

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid or expired recovery token"}
        self.user.refresh_from_db()
        assert self.user.password == previous_password
        assert "_auth_user_id" not in self.client.session

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_confirm_recovery_rejects_expired_token(self, send_recovery_email: MagicMock) -> None:
        previous_password = self.user.password
        self.request_recovery()
        password_hash = LostPasswordHash.objects.get(user=self.user)
        password_hash.update(date_added=timezone.now() - timedelta(hours=2))

        response = self.confirm_recovery(password_hash.hash)

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid or expired recovery token"}
        self.user.refresh_from_db()
        assert self.user.password == previous_password
        assert "_auth_user_id" not in self.client.session

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_confirm_recovery_rejects_suspended_account(
        self, send_recovery_email: MagicMock
    ) -> None:
        previous_password = self.user.password
        self.request_recovery()
        password_hash = LostPasswordHash.objects.get(user=self.user)
        self.user.update(is_suspended=True)

        response = self.confirm_recovery(password_hash.hash)

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid or expired recovery token"}
        self.user.refresh_from_db()
        assert self.user.password == previous_password
        assert not LostPasswordHash.objects.filter(user=self.user).exists()

    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_confirm_recovery_rejects_managed_account(self, send_recovery_email: MagicMock) -> None:
        previous_password = self.user.password
        self.request_recovery()
        password_hash = LostPasswordHash.objects.get(user=self.user)
        self.user.update(is_managed=True)

        response = self.confirm_recovery(password_hash.hash)

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid or expired recovery token"}
        self.user.refresh_from_db()
        assert self.user.password == previous_password
        assert not LostPasswordHash.objects.filter(user=self.user).exists()

    @patch(
        "sentry.api.endpoints.auth_recovery.ratelimiter.backend.is_limited",
        return_value=True,
    )
    def test_confirm_recovery_rate_limited(self, is_limited: MagicMock) -> None:
        response = self.client.post(reverse("sentry-api-0-auth-recovery-confirm"), data={})

        assert response.status_code == 429
        assert response.data == {"detail": "Too many password recovery attempts"}

    @override_settings(
        AUTH_PASSWORD_VALIDATORS=[
            {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"}
        ]
    )
    @patch("sentry.users.models.lostpasswordhash.LostPasswordHash.send_recover_password_email")
    def test_confirm_recovery_validates_password(self, send_recovery_email: MagicMock) -> None:
        self.request_recovery()
        password_hash = LostPasswordHash.objects.get(user=self.user)

        response = self.confirm_recovery(password_hash.hash, self.user.username)

        assert response.status_code == 400
        assert response.data == {"password": ["The password is too similar to the username."]}
        assert LostPasswordHash.objects.filter(user=self.user).exists()
        assert "_auth_user_id" not in self.client.session
