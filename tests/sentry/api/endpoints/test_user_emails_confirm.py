from __future__ import absolute_import

from sentry.utils.compat import mock

from django.core.urlresolvers import reverse

from sentry.models import UserEmail
from sentry.testutils import APITestCase


class UserEmailsConfirmTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email="foo@example.com")
        self.login_as(user=self.user)

    @mock.patch("sentry.models.User.send_confirm_email_singular")
    def test_can_confirm(self, send_confirm_email):
        email = UserEmail.objects.create(email="bar@example.com", is_verified=False, user=self.user)
        email.save()
        self.path = reverse("sentry-api-0-user-emails-confirm", kwargs={"user_id": self.user.id})
        resp = self.client.post(self.path, {"email": "bar@example.com"})
        assert resp.status_code == 204
        send_confirm_email.assert_called_once_with(UserEmail.objects.get(email="bar@example.com"))

    @mock.patch("sentry.models.User.send_confirm_email_singular")
    def test_cant_confirm_verified_email(self, send_confirm_email):
        email = UserEmail.objects.create(email="bar@example.com", is_verified=True, user=self.user)
        email.save()
        self.path = reverse("sentry-api-0-user-emails-confirm", kwargs={"user_id": self.user.id})
        resp = self.client.post(self.path, {"email": "bar@example.com"})
        assert resp.status_code == 400
        assert send_confirm_email.call_count == 0

    @mock.patch("sentry.models.User.send_confirm_email_singular")
    def test_validate_email(self, send_confirm_email):
        self.path = reverse("sentry-api-0-user-emails-confirm", kwargs={"user_id": self.user.id})
        resp = self.client.post(self.path, {"email": ""})
        assert resp.status_code == 400
        assert send_confirm_email.call_count == 0
