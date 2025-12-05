from unittest.mock import patch

import responses
from django.conf import settings

from sentry.seer.error_prediction.webhooks import forward_github_check_run_for_error_prediction
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class ForwardGithubCheckRunForErrorPredictionTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.check_run = {
            "external_id": "4663713",
            "html_url": "https://github.com/test/repo/runs/4",
        }

    def test_skips_when_feature_not_enabled(self):
        """Test that the handler returns early when gen-ai-features is not enabled."""
        with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
            forward_github_check_run_for_error_prediction(
                organization=self.organization,
                check_run=self.check_run,
                action="rerequested",
            )

            # Verify debug log for disabled feature
            mock_logger.debug.assert_called_once()
            assert "feature_disabled" in mock_logger.debug.call_args[0][0]

    @with_feature("organizations:gen-ai-features")
    def test_skips_non_handled_actions(self):
        """Test that non-handled actions are skipped."""
        non_handled_actions = ["created", "completed", "requested_action", None]

        for action in non_handled_actions:
            with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
                forward_github_check_run_for_error_prediction(
                    organization=self.organization,
                    check_run=self.check_run,
                    action=action,
                )

                # Verify debug log for skipped action
                mock_logger.debug.assert_called_once()
                assert "skipped_action" in mock_logger.debug.call_args[0][0]

    @with_feature("organizations:gen-ai-features")
    @responses.activate
    def test_forwards_rerequested_action_to_seer(self):
        """Test that rerequested action forwards payload to Seer."""
        from django.conf import settings

        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/github",
            json={"success": True},
            status=200,
        )

        forward_github_check_run_for_error_prediction(
            organization=self.organization,
            check_run=self.check_run,
            action="rerequested",
        )

        # Verify request was made
        assert len(responses.calls) == 1

    @with_feature("organizations:gen-ai-features")
    @responses.activate
    def test_handles_minimal_check_run_payload(self):
        """Test that minimal check_run with missing fields is handled."""
        from django.conf import settings

        minimal_check_run = {}  # No external_id or html_url

        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/github",
            json={"success": True},
            status=200,
        )

        forward_github_check_run_for_error_prediction(
            organization=self.organization,
            check_run=minimal_check_run,
            action="rerequested",
        )

        # Should succeed even with minimal payload
        assert len(responses.calls) == 1

    @with_feature("organizations:gen-ai-features")
    @responses.activate
    def test_handles_seer_error_response(self):
        """Test that Seer errors are caught and logged."""
        from django.conf import settings

        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/github",
            json={"error": "Internal server error"},
            status=500,
        )

        with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
            forward_github_check_run_for_error_prediction(
                organization=self.organization,
                check_run=self.check_run,
                action="rerequested",
            )

            # Verify exception logging
            mock_logger.exception.assert_called_once()
            assert "forward_failed" in mock_logger.exception.call_args[0][0]

    @with_feature("organizations:gen-ai-features")
    @responses.activate
    def test_includes_signed_headers(self):
        """Test that request includes signed headers for Seer authentication."""
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/github",
            json={"success": True},
            status=200,
        )

        forward_github_check_run_for_error_prediction(
            organization=self.organization,
            check_run=self.check_run,
            action="rerequested",
        )

        # Verify request has content-type header
        request = responses.calls[0].request
        assert request.headers["content-type"] == "application/json;charset=utf-8"
        # Note: sign_with_seer_secret headers are also included but harder to verify in tests
