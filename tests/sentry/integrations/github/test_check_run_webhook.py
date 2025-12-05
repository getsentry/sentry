from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fixtures.github import (
    CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
    CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
)
from sentry import options
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode


class CheckRunEventWebhookTest(APITestCase):
    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def _create_integration_and_send_check_run_event(self, event_data):
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)

        # Signatures computed for CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE
        # If using different event data, signatures need to be recomputed
        sha1_sig = "sha1=b4094fea7a98e82f508191a34d3f92d646b76e7d"
        sha256_sig = "sha256=b1d21a975b158ce2ebb04538af7aab22373be3dc4193fc47c5feb555462a77f5"

        response = self.client.post(
            path=self.url,
            data=event_data,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="check_run",
            HTTP_X_HUB_SIGNATURE=sha1_sig,
            HTTP_X_HUB_SIGNATURE_256=sha256_sig,
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204
        return response

    @patch("sentry.integrations.github.webhook.CheckRunEventWebhook.__call__")
    def test_check_run_requested_action_event_triggers_handler(
        self, mock_event_handler: MagicMock
    ) -> None:
        """Test that check_run requested_action events trigger the webhook handler."""
        self._create_integration_and_send_check_run_event(
            CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE
        )
        assert mock_event_handler.called

    @patch("sentry.seer.error_prediction.webhooks.handle_github_check_run_for_error_prediction")
    @with_feature("organizations:gen-ai-features")
    def test_check_run_completed_calls_error_prediction(
        self, mock_error_prediction: MagicMock
    ) -> None:
        """Test that completed check_run events call the error prediction handler."""
        self._create_integration_and_send_check_run_event(CHECK_RUN_COMPLETED_EVENT_EXAMPLE)

        assert mock_error_prediction.called

        # Verify the handler was called with correct arguments
        call_args = mock_error_prediction.call_args
        assert call_args is not None
        kwargs = call_args.kwargs

        assert "organization" in kwargs
        assert kwargs["organization"].id == self.organization.id
        assert "check_run" in kwargs
        assert kwargs["check_run"]["id"] == 4
        assert kwargs["check_run"]["status"] == "completed"
        assert kwargs["action"] == "completed"
        assert "repository" in kwargs
        assert kwargs["repository"]["full_name"] == "baxterthehacker/public-repo"

    @patch("sentry.seer.error_prediction.webhooks.handle_github_check_run_for_error_prediction")
    @patch("sentry.integrations.github.webhook.logger")
    @with_feature("organizations:gen-ai-features")
    def test_check_run_logs_received_event(
        self, mock_logger: MagicMock, mock_error_prediction: MagicMock
    ) -> None:
        """Test that check_run events are logged when received."""
        self._create_integration_and_send_check_run_event(CHECK_RUN_COMPLETED_EVENT_EXAMPLE)

        # Verify logging occurred
        mock_logger.info.assert_called()
        log_calls = [call for call in mock_logger.info.call_args_list]

        # Check for the "received" log
        received_logs = [
            call for call in log_calls if "github.webhook.check_run.received" in str(call)
        ]
        assert len(received_logs) > 0

    @patch("sentry.seer.error_prediction.webhooks.handle_github_check_run_for_error_prediction")
    @with_feature("organizations:gen-ai-features")
    def test_check_run_handles_error_prediction_exception(
        self, mock_error_prediction: MagicMock
    ) -> None:
        """Test that exceptions in error prediction handler are caught and logged."""
        mock_error_prediction.side_effect = Exception("Test error")
        self._create_integration_and_send_check_run_event(CHECK_RUN_COMPLETED_EVENT_EXAMPLE)

    def test_check_run_without_integration_returns_204(self) -> None:
        """Test that check_run events without integration return 204."""
        # Don't create an integration, just send the event
        response = self.client.post(
            path=self.url,
            data=CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="check_run",
            HTTP_X_HUB_SIGNATURE="sha1=b4094fea7a98e82f508191a34d3f92d646b76e7d",
            HTTP_X_HUB_SIGNATURE_256="sha256=b1d21a975b158ce2ebb04538af7aab22373be3dc4193fc47c5feb555462a77f5",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        # Should still return 204 even without integration
        assert response.status_code == 204
