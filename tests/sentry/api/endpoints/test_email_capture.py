from unittest import mock

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.marketo_client import MarketoClient


class EmailCaptureTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        # demo user
        self.demo_user = self.create_user()
        self.demo_om = self.create_member(
            organization=self.organization, user=self.demo_user, role="member"
        )

    @mock.patch.object(MarketoClient, "submit_form")
    @override_options({"demo-mode.enabled": True})
    def test_capture_endpoint(self, mock_submit_form):
        self.login_as(self.demo_user)
        url = reverse("sentry-demo-mode-email-capture")
        response = self.client.post(url, {"email": "test123@sentry.io"})
        assert response.status_code == 200, response.content
        mock_submit_form.assert_called_once_with({"email": "test123@sentry.io"})

    @override_options({"demo-mode.enabled": False})
    def test_capture_endpoint_disabled(self):
        self.login_as(self.demo_user)
        url = reverse("sentry-demo-mode-email-capture")
        response = self.client.post(url, {"email": "test123@sentry.io"})
        assert response.status_code == 404

    @override_options({"demo-mode.enabled": True})
    def test_capture_endpoint_bad_request(self):
        self.login_as(self.demo_user)
        url = reverse("sentry-demo-mode-email-capture")
        response = self.client.post(url, {"email": "test123"})
        assert response.status_code == 400
        assert response.data == {"email": ["Enter a valid email address."]}
