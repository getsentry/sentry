from unittest import mock

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.useremail import UserEmail
from sentry.utils.signing import sign


@control_silo_test
class UserEmailsConfirmTest(APITestCase):
    endpoint = "sentry-api-0-user-emails-confirm"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @mock.patch("sentry.users.models.user.User.send_confirm_email_singular")
    def test_can_confirm(self, send_confirm_email):
        email = UserEmail.objects.create(email="bar@example.com", is_verified=False, user=self.user)
        email.save()

        self.get_success_response(self.user.id, email="bar@example.com", status_code=204)
        send_confirm_email.assert_called_once_with(UserEmail.objects.get(email="bar@example.com"))

    @mock.patch("sentry.users.models.user.User.send_confirm_email_singular")
    def test_can_confirm_with_uppercase(self, send_confirm_email):
        email = UserEmail.objects.create(email="Bar@example.com", is_verified=False, user=self.user)
        email.save()

        self.get_success_response(self.user.id, email="Bar@example.com", status_code=204)
        send_confirm_email.assert_called_once_with(UserEmail.objects.get(email="Bar@example.com"))

    @mock.patch("sentry.users.models.user.User.send_confirm_email_singular")
    def test_cant_confirm_verified_email(self, send_confirm_email):
        email = UserEmail.objects.create(email="bar@example.com", is_verified=True, user=self.user)
        email.save()

        self.get_error_response(self.user.id, email="bar@example.com", status_code=400)
        assert send_confirm_email.call_count == 0

    @mock.patch("sentry.users.models.user.User.send_confirm_email_singular")
    def test_validate_email(self, send_confirm_email):
        self.get_error_response(self.user.id, email="", status_code=400)
        assert send_confirm_email.call_count == 0

    @override_options(
        {
            "user-settings.signed-url-confirmation-emails": True,
            "user-settings.signed-url-confirmation-emails-salt": "signed-url-confirmation-emails-salt",
        }
    )
    def test_confirm_email_signed_url(self):
        from sentry import options

        EMAIL_CONFIRMATION_SALT = options.get("user-settings.signed-url-confirmation-emails-salt")

        self.login_as(self.user)

        new_email = "newemailfromsignedurl@example.com"

        signed_data = sign(
            user_id=self.user.id,
            email=new_email,
            salt=EMAIL_CONFIRMATION_SALT,
        )

        signed_url = reverse("sentry-account-confirm-signed-email", args=[signed_data])

        resp = self.client.get(signed_url, follow=True)
        assert resp.status_code == 200
        assert resp.redirect_chain == [(reverse("sentry-account-settings-emails"), 302)]

        new_user_email = UserEmail.objects.get(user=self.user, email=new_email)
        assert new_user_email.is_verified

        messages = list(resp.context["messages"])
        assert len(messages) == 1
        assert messages[0].message == "Thanks for confirming your email"

    @override_options(
        {
            "user-settings.signed-url-confirmation-emails": True,
            "user-settings.signed-url-confirmation-emails-salt": "signed-url-confirmation-emails-salt",
        }
    )
    def test_confirm_email_invalid_signed_url(self):
        self.login_as(self.user)

        new_email = "newemailfromsignedurl@example.com"

        signed_data = sign(
            user_id=self.user.id,
            email=new_email,
            salt="invalid-salt",
        )

        signed_url = reverse("sentry-account-confirm-signed-email", args=[signed_data])

        resp = self.client.get(signed_url, follow=True)
        assert resp.status_code == 200
        assert resp.redirect_chain == [(reverse("sentry-account-settings-emails"), 302)]

        # the email should not be added
        user_email_counts = UserEmail.objects.filter(user=self.user).count()
        assert user_email_counts == 1

        messages = list(resp.context["messages"])
        assert len(messages) == 1
        assert (
            messages[0].message
            == "There was an error confirming your email. Please try again or visit your Account Settings to resend the verification email."
        )

    @override_options(
        {
            "user-settings.signed-url-confirmation-emails": True,
            "user-settings.signed-url-confirmation-emails-salt": "signed-url-confirmation-emails-salt",
        }
    )
    def test_confirm_email_already_verified(self):
        from sentry import options

        EMAIL_CONFIRMATION_SALT = options.get("user-settings.signed-url-confirmation-emails-salt")

        self.login_as(self.user)

        new_email = "newemailfromsignedurl@example.com"

        # Create already verified email
        UserEmail.objects.create(
            user=self.user,
            email=new_email,
            is_verified=True,
        )

        signed_data = sign(
            user_id=self.user.id,
            email=new_email,
            salt=EMAIL_CONFIRMATION_SALT,
        )

        signed_url = reverse("sentry-account-confirm-signed-email", args=[signed_data])

        resp = self.client.get(signed_url, follow=True)
        assert resp.status_code == 200
        assert resp.redirect_chain == [(reverse("sentry-account-settings-emails"), 302)]

        messages = list(resp.context["messages"])
        assert len(messages) == 1
        assert (
            messages[0].message == "The email you are trying to verify has already been verified."
        )

    @override_options(
        {
            "user-settings.signed-url-confirmation-emails": True,
            "user-settings.signed-url-confirmation-emails-salt": "signed-url-confirmation-emails-salt",
        }
    )
    def test_confirm_email_expired_signature(self):
        from datetime import timedelta

        from django.utils import timezone

        self.login_as(self.user)

        new_email = "newemailfromsignedurl@example.com"

        with mock.patch("django.core.signing.time.time") as mock_time:
            past_time = timezone.now() - timedelta(days=7)
            mock_time.return_value = past_time.timestamp()

            signed_data = sign(
                user_id=self.user.id,
                email=new_email,
                salt="signed-url-confirmation-emails-salt",
            )

        signed_url = reverse("sentry-account-confirm-signed-email", args=[signed_data])
        resp = self.client.get(signed_url, follow=True)

        assert resp.status_code == 200
        assert resp.redirect_chain == [(reverse("sentry-account-settings-emails"), 302)]

        messages = list(resp.context["messages"])
        assert len(messages) == 1
        assert (
            messages[0].message
            == "The confirmation link has expired. Please visit your Account Settings to resend the verification email."
        )

    @override_options(
        {
            "user-settings.signed-url-confirmation-emails": False,
            "user-settings.signed-url-confirmation-emails-salt": "signed-url-confirmation-emails-salt",
        }
    )
    def test_confirm_email_signed_urls_disabled(self):
        self.login_as(self.user)

        new_email = "newemailfromsignedurl@example.com"
        signed_data = sign(
            user_id=self.user.id,
            email=new_email,
            salt="signed-url-confirmation-emails-salt",
        )
        resp = self.client.get(
            reverse("sentry-account-confirm-signed-email", args=[signed_data]), follow=True
        )
        assert resp.status_code == 404
