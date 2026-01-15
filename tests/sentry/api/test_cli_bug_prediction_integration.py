from unittest.mock import patch

import pytest

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@pytest.mark.django_db
class CliBugPredictionIntegrationTest(APITestCase):
    """
    Integration tests for CLI bug prediction end-to-end flow.

    These tests verify the full request-response cycle including polling logic.
    """

    endpoint = "sentry-api-0-organization-code-review-local"
    method = "post"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.repository = self.create_repo(
            project=self.project,
            name="test-repo",
            provider="github",
            external_id="12345",
        )
        self.valid_payload = {
            "repository": {
                "owner": "getsentry",
                "name": "test-repo",
                "provider": "github",
                "base_commit_sha": "a" * 40,
            },
            "diff": "diff --git a/file.py b/file.py\n+print('hello')\n",
        }
        self.login_as(user=self.user)

    @with_feature("organizations:code-review-local")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.get_cli_bug_prediction_status")
    def test_end_to_end_single_poll(self, mock_status, mock_trigger):
        """Test end-to-end flow with immediate completion"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        # First poll returns completed
        mock_status.return_value = {
            "status": "completed",
            "run_id": 123,
            "predictions": [
                {
                    "location": "file.py#L10",
                    "short_description": "Bug found",
                    "explanation": "Details",
                    "severity": "medium",
                    "source": "code",
                }
            ],
            "diagnostics": {"files_analyzed": 1, "execution_time_seconds": 15.0},
        }

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        # Verify trigger was called
        assert mock_trigger.call_count == 1
        # Verify status was checked once
        assert mock_status.call_count == 1
        # Verify response contains predictions
        assert response.data["status"] == "completed"
        assert len(response.data["predictions"]) == 1

    @with_feature("organizations:code-review-local")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.get_cli_bug_prediction_status")
    @patch("time.sleep")
    def test_end_to_end_multiple_polls(self, mock_sleep, mock_status, mock_trigger):
        """Test end-to-end flow with multiple polling cycles"""
        mock_trigger.return_value = {"run_id": 456, "status": "pending"}

        # Simulate state transitions: pending -> in_progress -> completed
        mock_status.side_effect = [
            {"status": "pending", "run_id": 456},
            {"status": "in_progress", "run_id": 456},
            {"status": "in_progress", "run_id": 456},
            {
                "status": "completed",
                "run_id": 456,
                "predictions": [
                    {
                        "location": "test.py#L5",
                        "short_description": "Issue detected",
                        "explanation": "Full explanation",
                        "severity": "high",
                        "source": "ml",
                    }
                ],
                "diagnostics": {"files_analyzed": 3, "execution_time_seconds": 120.0},
            },
        ]

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        # Verify trigger was called once
        assert mock_trigger.call_count == 1
        # Verify status was checked 4 times (3 pending/in_progress, 1 completed)
        assert mock_status.call_count == 4
        # Verify sleep was called between polls (3 times for 4 polls)
        assert mock_sleep.call_count == 3
        # Verify final response
        assert response.data["status"] == "completed"
        assert response.data["predictions"][0]["severity"] == "high"

    @with_feature("organizations:code-review-local")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.get_cli_bug_prediction_status")
    @patch("time.sleep")
    def test_status_check_network_error_recovery(self, mock_sleep, mock_status, mock_trigger):
        """Test that network errors during status check are retried"""
        from urllib3.exceptions import TimeoutError

        mock_trigger.return_value = {"run_id": 789, "status": "pending"}

        # First status check times out, second succeeds
        mock_status.side_effect = [
            TimeoutError("Network timeout"),
            {
                "status": "completed",
                "run_id": 789,
                "predictions": [],
                "diagnostics": {},
            },
        ]

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        # Verify status was called twice (once failed, once succeeded)
        assert mock_status.call_count == 2
        # Verify we still got a successful response
        assert response.data["status"] == "completed"

    @with_feature("organizations:code-review-local")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.get_cli_bug_prediction_status")
    def test_empty_predictions_response(self, mock_status, mock_trigger):
        """Test handling of completed status with no predictions"""
        mock_trigger.return_value = {"run_id": 999, "status": "pending"}
        mock_status.return_value = {
            "status": "completed",
            "run_id": 999,
            "predictions": [],  # No bugs found
            "diagnostics": {"files_analyzed": 5, "execution_time_seconds": 30.0},
        }

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        assert response.data["status"] == "completed"
        assert response.data["predictions"] == []
        assert response.data["diagnostics"]["files_analyzed"] == 5

    @with_feature("organizations:code-review-local")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.get_cli_bug_prediction_status")
    @patch("time.sleep")
    def test_multiple_predictions(self, mock_sleep, mock_status, mock_trigger):
        """Test handling of multiple predictions in response"""
        mock_trigger.return_value = {"run_id": 111, "status": "pending"}
        mock_status.return_value = {
            "status": "completed",
            "run_id": 111,
            "predictions": [
                {
                    "location": "file1.py#L10",
                    "short_description": "Bug 1",
                    "explanation": "First bug",
                    "severity": "high",
                    "source": "code",
                },
                {
                    "location": "file2.py#L20",
                    "short_description": "Bug 2",
                    "explanation": "Second bug",
                    "severity": "medium",
                    "source": "ml",
                },
                {
                    "location": "file3.py#L30",
                    "short_description": "Bug 3",
                    "explanation": "Third bug",
                    "severity": "low",
                    "source": "code",
                },
            ],
            "diagnostics": {"files_analyzed": 3, "execution_time_seconds": 90.0},
        }

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        assert len(response.data["predictions"]) == 3
        assert response.data["predictions"][0]["severity"] == "high"
        assert response.data["predictions"][1]["severity"] == "medium"
        assert response.data["predictions"][2]["severity"] == "low"

    @with_feature("organizations:code-review-local")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.get_cli_bug_prediction_status")
    @patch("time.sleep")
    def test_seer_state_transition_pending_to_completed(
        self, mock_sleep, mock_status, mock_trigger
    ):
        """Test state transition from pending directly to completed"""
        mock_trigger.return_value = {"run_id": 222, "status": "pending"}
        mock_status.side_effect = [
            {"status": "pending", "run_id": 222},
            {
                "status": "completed",
                "run_id": 222,
                "predictions": [],
                "diagnostics": {},
            },
        ]

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        assert mock_status.call_count == 2
        assert response.data["status"] == "completed"

    @with_feature("organizations:code-review-local")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.get_cli_bug_prediction_status")
    @patch("time.sleep")
    def test_seer_state_transition_with_in_progress(self, mock_sleep, mock_status, mock_trigger):
        """Test state transition: pending -> in_progress -> completed"""
        mock_trigger.return_value = {"run_id": 333, "status": "pending"}
        mock_status.side_effect = [
            {"status": "pending", "run_id": 333},
            {"status": "in_progress", "run_id": 333},
            {
                "status": "completed",
                "run_id": 333,
                "predictions": [],
                "diagnostics": {},
            },
        ]

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        assert mock_status.call_count == 3
        assert response.data["status"] == "completed"

    @with_feature("organizations:code-review-local")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.api.endpoints.organization_cli_bug_prediction.get_cli_bug_prediction_status")
    def test_diagnostics_included_in_response(self, mock_status, mock_trigger):
        """Test that diagnostics are properly included in response"""
        mock_trigger.return_value = {"run_id": 444, "status": "pending"}
        mock_status.return_value = {
            "status": "completed",
            "run_id": 444,
            "predictions": [],
            "diagnostics": {
                "files_analyzed": 10,
                "execution_time_seconds": 145.5,
                "total_lines_analyzed": 5000,
                "model_version": "v2.0",
            },
        }

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        diagnostics = response.data["diagnostics"]
        assert diagnostics["files_analyzed"] == 10
        assert diagnostics["execution_time_seconds"] == 145.5
        assert diagnostics["total_lines_analyzed"] == 5000
        assert diagnostics["model_version"] == "v2.0"
