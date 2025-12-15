from unittest.mock import patch

import orjson
import responses
from django.conf import settings

from sentry.seer.error_prediction.webhooks import (
    SEER_PR_REVIEW_RERUN_PATH,
    handle_github_check_run_event,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class HandleGithubCheckRunEventTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.action_rerequested_event = {
            "action": "rerequested",
            "check_run": {
                "external_id": "4663713",
                "html_url": "https://github.com/test/repo/runs/4",
            },
        }

    def test_skips_when_prevent_ai_features_disabled(self):
        """Test that the handler returns early when AI features are not enabled."""
        # Without enabling feature flags, can_use_prevent_ai_features returns False
        success = handle_github_check_run_event(
            self.organization,
            event=self.action_rerequested_event,
        )
        assert not success

    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_skips_non_handled_actions(self):
        """Test that non-handled actions are skipped."""
        non_handled_actions = ["created", "completed", "requested_action", None]

        for action in non_handled_actions:
            event = {
                "action": action,
                "check_run": {
                    "external_id": "4663713",
                    "html_url": "https://github.com/test/repo/runs/4",
                },
            }
            success = handle_github_check_run_event(self.organization, event)
            assert not success

    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_skips_when_option_disabled(self):
        """Test that handler returns early when the option is disabled."""
        with self.options(
            {"coding_workflows.error_prediction.github.check_run.rerun.enabled": False}
        ):
            success = handle_github_check_run_event(
                self.organization,
                event=self.action_rerequested_event,
            )
            assert not success

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_forwards_rerequested_action_to_seer(self):
        """Test that rerequested action forwards original_run_id to Seer."""
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}{SEER_PR_REVIEW_RERUN_PATH}",
            json={"success": True},
            status=200,
        )

        with self.options(
            {"coding_workflows.error_prediction.github.check_run.rerun.enabled": True}
        ):
            success = handle_github_check_run_event(
                self.organization,
                event=self.action_rerequested_event,
            )
            assert success

            # Verify request was made with correct payload
            assert len(responses.calls) == 1
            body = orjson.loads(responses.calls[0].request.body)
            assert body == {"original_run_id": 4663713}

    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_fails_when_external_id_missing(self):
        """Test that missing external_id returns False."""
        event = {
            "action": "rerequested",
            "check_run": {"html_url": "https://github.com/test/repo/runs/4"},
        }

        with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
            success = handle_github_check_run_event(self.organization, event)
            assert not success
            mock_logger.warning.assert_called_once()
            assert "missing_external_id" in mock_logger.warning.call_args[0][0]

    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_fails_when_external_id_not_numeric(self):
        """Test that non-numeric external_id returns False."""
        event = {
            "action": "rerequested",
            "check_run": {"external_id": "not-a-number"},
        }

        with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
            success = handle_github_check_run_event(self.organization, event)
            assert not success
            mock_logger.warning.assert_called_once()
            assert "missing_external_id" in mock_logger.warning.call_args[0][0]

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_handles_seer_error_response(self):
        """Test that Seer errors are caught and logged."""
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}{SEER_PR_REVIEW_RERUN_PATH}",
            json={"error": "Internal server error"},
            status=500,
        )

        with self.options(
            {"coding_workflows.error_prediction.github.check_run.rerun.enabled": True}
        ):
            with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
                success = handle_github_check_run_event(
                    self.organization,
                    event=self.action_rerequested_event,
                )
                assert not success
                # Verify exception logging
                mock_logger.exception.assert_called_once()
                assert "forward.exception" in mock_logger.exception.call_args[0][0]

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_includes_signed_headers(self):
        """Test that request includes signed headers for Seer authentication."""
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}{SEER_PR_REVIEW_RERUN_PATH}",
            json={"success": True},
            status=200,
        )

        with self.options(
            {"coding_workflows.error_prediction.github.check_run.rerun.enabled": True}
        ):
            success = handle_github_check_run_event(
                self.organization,
                event=self.action_rerequested_event,
            )
            assert success

            # Verify request has content-type header
            request = responses.calls[0].request
            assert request.headers["content-type"] == "application/json;charset=utf-8"
