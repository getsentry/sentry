from unittest.mock import patch

import orjson
import pytest
from slack_sdk.errors import SlackApiError

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.slack.sdk_client import SLACK_DATADOG_METRIC, SlackSdkClient
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of


class SlackClientTest(TestCase):
    def setUp(self):
        self.access_token = "xoxb-access-token"
        self.integration, self.organization_integration = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            external_id="slack:1",
            provider="slack",
            metadata={"access_token": self.access_token},
        )

    def test_no_integration_found_error(self):
        with pytest.raises(ValueError):
            SlackSdkClient(integration_id=2)

    def test_inactive_integration_error(self):
        with assume_test_silo_mode_of(Integration):
            self.integration.update(status=ObjectStatus.DISABLED)

        with pytest.raises(ValueError):
            SlackSdkClient(self.integration.id)

    def test_no_access_token_error(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(metadata={})

        with pytest.raises(ValueError):
            SlackSdkClient(integration_id=self.integration.id)

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_api_call_success(self, mock_api_call, mock_metrics):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        client = SlackSdkClient(integration_id=self.integration.id)

        client.chat_postMessage(channel="#announcements", text="hello")
        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": True, "status": 200},
        )

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_api_call_error(self, mock_api_call, mock_metrics):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": False}).decode() + "'",
            "headers": {},
            "status": 500,
        }

        client = SlackSdkClient(integration_id=self.integration.id)

        with pytest.raises(SlackApiError):
            client.chat_postMessage(channel="#announcements", text="hello")

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": False, "status": 500},
        )

    @patch("sentry.integrations.slack.sdk_client.metrics")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_api_call_timeout_error(self, mock_api_call, mock_metrics):
        mock_api_call.side_effect = TimeoutError()

        client = SlackSdkClient(integration_id=self.integration.id)

        with pytest.raises(TimeoutError):
            client.chat_postMessage(channel="#announcements", text="hello")

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"status": "timeout"},
        )
