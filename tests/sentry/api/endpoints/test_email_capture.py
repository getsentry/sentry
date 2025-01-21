from unittest import mock

from django.test import override_settings
from django.urls import reverse
from sentrydemo.marketo_client import MarketoClient
from sentrydemo.models import DemoUser
from sentrydemo.settings import MIDDLEWARE  # noqa

from sentry.testutils import APITestCase


@override_settings(DEMO_MODE=True, ROOT_URLCONF="sentrydemo.urls")
class EmailCaptureTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        # demo user
        self.demo_user = DemoUser.create_user()
        self.demo_om = self.create_member(
            organization=self.organization, user=self.demo_user, role="member"
        )

    @mock.patch.object(MarketoClient, "submit_form")
    def test_capture_endpoint(self, mock_submit_form):
        self.login_as(self.demo_user)
        url = reverse("sentry-demo-email-capture")
        response = self.client.post(url, {"email": "test123@sentry.io"})
        assert response.status_code == 200, response.content
        mock_submit_form.assert_called_once_with({"email": "test123@sentry.io"})
