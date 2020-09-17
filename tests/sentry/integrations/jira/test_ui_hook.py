from __future__ import absolute_import

from jwt import ExpiredSignatureError

from sentry.integrations.atlassian_connect import AtlassianConnectValidationError
from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch
from sentry.utils.http import absolute_uri


UNABLE_TO_VERIFY_INSTALLATION = b"Unable to verify installation"
REFRESH_REQUIRED = b"This page has expired, please refresh to configure your Sentry integration"
CLICK_TO_FINISH = b"Click to Finish Installation"


class JiraUiHookViewTestCase(APITestCase):
    def setUp(self):
        super(JiraUiHookViewTestCase, self).setUp()
        self.path = absolute_uri("extensions/jira/ui-hook/") + "?xdm_e=base_url"

        self.user.name = "Sentry Admin"
        self.user.save()

        self.integration = Integration.objects.create(provider="jira", name="Example Jira")


class JiraUiHookViewErrorsTest(JiraUiHookViewTestCase):
    @patch(
        "sentry.integrations.jira.ui_hook.get_integration_from_request",
        side_effect=ExpiredSignatureError(),
    )
    def test_expired_signature_error(self, mock_get_integration_from_request):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert REFRESH_REQUIRED in response.content

    @patch(
        "sentry.integrations.jira.ui_hook.get_integration_from_request",
        side_effect=AtlassianConnectValidationError(),
    )
    def test_expired_invalid_installation_error(self, mock_get_integration_from_request):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert UNABLE_TO_VERIFY_INSTALLATION in response.content


class JiraUiHookViewTest(JiraUiHookViewTestCase):
    def setUp(self):
        super(JiraUiHookViewTest, self).setUp()
        self.login_as(self.user)

    def assert_no_errors(self, response):
        assert REFRESH_REQUIRED not in response.content
        assert UNABLE_TO_VERIFY_INSTALLATION not in response.content

    @patch("sentry.integrations.jira.ui_hook.get_integration_from_request")
    def test_simple_get(self, mock_get_integration_from_request):
        mock_get_integration_from_request.return_value = self.integration
        response = self.client.get(self.path)
        assert response.status_code == 200
        self.assert_no_errors(response)
        assert CLICK_TO_FINISH in response.content
