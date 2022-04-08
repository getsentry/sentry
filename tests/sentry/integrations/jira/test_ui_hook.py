from unittest.mock import patch

from jwt import ExpiredSignatureError

from sentry.integrations.jira.views import UNABLE_TO_VERIFY_INSTALLATION
from sentry.integrations.utils import AtlassianConnectValidationError
from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri

REFRESH_REQUIRED = b"This page has expired, please refresh to configure your Sentry integration"
CLICK_TO_FINISH = b"Finish Installation in Sentry"


class JiraUiHookViewTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.path = absolute_uri("extensions/jira/ui-hook/") + "?xdm_e=base_url"

        self.user.name = "Sentry Admin"
        self.user.save()

        self.integration = Integration.objects.create(provider="jira", name="Example Jira")


class JiraUiHookViewErrorsTest(JiraUiHookViewTestCase):
    @patch(
        "sentry.integrations.jira.views.ui_hook.get_integration_from_request",
        side_effect=ExpiredSignatureError(),
    )
    def test_expired_signature_error(self, mock_get_integration_from_request):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert REFRESH_REQUIRED in response.content

    @patch(
        "sentry.integrations.jira.views.ui_hook.get_integration_from_request",
        side_effect=AtlassianConnectValidationError(),
    )
    def test_expired_invalid_installation_error(self, mock_get_integration_from_request):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert UNABLE_TO_VERIFY_INSTALLATION.encode() in response.content


class JiraUiHookViewTest(JiraUiHookViewTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def assert_no_errors(self, response):
        assert REFRESH_REQUIRED not in response.content
        assert UNABLE_TO_VERIFY_INSTALLATION.encode() not in response.content

    @patch("sentry.integrations.jira.views.ui_hook.get_integration_from_request")
    def test_simple_get(self, mock_get_integration_from_request):
        mock_get_integration_from_request.return_value = self.integration
        response = self.client.get(self.path)
        assert response.status_code == 200
        self.assert_no_errors(response)
        assert CLICK_TO_FINISH in response.content
