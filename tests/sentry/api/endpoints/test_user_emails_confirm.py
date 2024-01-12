from unittest import mock

from sentry.models.useremail import UserEmail
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserEmailsConfirmTest(APITestCase):
    endpoint = "sentry-api-0-user-emails-confirm"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @mock.patch("sentry.models.User.send_confirm_email_singular")
    def test_can_confirm(self, send_confirm_email):
        email = UserEmail.objects.create(email="bar@example.com", is_verified=False, user=self.user)
        email.save()

        self.get_success_response(self.user.id, email="bar@example.com", status_code=204)
        send_confirm_email.assert_called_once_with(UserEmail.objects.get(email="bar@example.com"))

    @mock.patch("sentry.models.User.send_confirm_email_singular")
    def test_can_confirm_with_uppercase(self, send_confirm_email):
        email = UserEmail.objects.create(email="Bar@example.com", is_verified=False, user=self.user)
        email.save()

        self.get_success_response(self.user.id, email="Bar@example.com", status_code=204)
        send_confirm_email.assert_called_once_with(UserEmail.objects.get(email="Bar@example.com"))

    @mock.patch("sentry.models.User.send_confirm_email_singular")
    def test_cant_confirm_verified_email(self, send_confirm_email):
        email = UserEmail.objects.create(email="bar@example.com", is_verified=True, user=self.user)
        email.save()

        self.get_error_response(self.user.id, email="bar@example.com", status_code=400)
        assert send_confirm_email.call_count == 0

    @mock.patch("sentry.models.User.send_confirm_email_singular")
    def test_validate_email(self, send_confirm_email):
        self.get_error_response(self.user.id, email="", status_code=400)
        assert send_confirm_email.call_count == 0
