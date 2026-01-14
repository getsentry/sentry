from unittest.mock import patch

import pytest

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@pytest.mark.django_db
class OrganizationCliBugPredictionTest(APITestCase):
    endpoint = "sentry-api-0-organization-cli-bug-prediction"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.repository = self.create_repo(
            name="test-repo",
            provider="github",
            external_id="12345",
            organization_id=self.organization.id,
        )
        self.valid_payload = {
            "repository": {
                "owner": "getsentry",
                "name": "test-repo",
                "provider": "github",
                "base_commit_sha": "a" * 40,
            },
            "diff": "diff --git a/file.py b/file.py\n+print('hello')\n",
            "current_branch": "feature/test",
            "commit_message": "Add feature",
        }
        self.login_as(user=self.user)

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.seer.cli_bug_prediction.get_cli_bug_prediction_status")
    def test_happy_path(self, mock_status, mock_trigger):
        """Test successful prediction request"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        mock_status.return_value = {
            "status": "completed",
            "run_id": 123,
            "predictions": [
                {
                    "location": "file.py#L10",
                    "short_description": "Potential bug",
                    "explanation": "Detailed explanation",
                    "severity": "high",
                    "source": "code",
                }
            ],
            "diagnostics": {"files_analyzed": 1, "execution_time_seconds": 30.0},
        }

        response = self.get_success_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=200,
        )

        assert response.data["status"] == "completed"
        assert len(response.data["predictions"]) == 1
        assert response.data["predictions"][0]["location"] == "file.py#L10"
        assert response.data["seer_run_id"] == 123
        assert response.data["diagnostics"]["files_analyzed"] == 1

    def test_feature_flag_disabled(self):
        """Test that request fails when feature flag is disabled"""
        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=403,
        )

        assert "not enabled" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    def test_invalid_diff_too_large(self):
        """Test validation fails for diff exceeding 500KB"""
        payload = self.valid_payload.copy()
        payload["diff"] = "x" * 600_000  # 600KB

        response = self.get_error_response(
            self.organization.slug,
            **payload,
            status_code=400,
        )

        assert "detail" in response.data

    @with_feature("organizations:cli-bug-prediction")
    def test_invalid_diff_too_many_files(self):
        """Test validation fails for diff with too many files"""
        payload = self.valid_payload.copy()
        # Create diff with 51 files
        payload["diff"] = "\n".join([f"diff --git a/file{i}.py b/file{i}.py" for i in range(51)])

        response = self.get_error_response(
            self.organization.slug,
            **payload,
            status_code=400,
        )

        assert "detail" in response.data

    @with_feature("organizations:cli-bug-prediction")
    def test_invalid_diff_empty(self):
        """Test validation fails for empty diff"""
        payload = self.valid_payload.copy()
        payload["diff"] = "no diff markers here"

        response = self.get_error_response(
            self.organization.slug,
            **payload,
            status_code=400,
        )

        assert "detail" in response.data

    @with_feature("organizations:cli-bug-prediction")
    def test_invalid_commit_sha_format(self):
        """Test validation fails for invalid commit SHA format"""
        payload = self.valid_payload.copy()
        payload["repository"]["base_commit_sha"] = "invalid_sha"

        response = self.get_error_response(
            self.organization.slug,
            **payload,
            status_code=400,
        )

        assert "detail" in response.data

    @with_feature("organizations:cli-bug-prediction")
    def test_invalid_commit_sha_length(self):
        """Test validation fails for wrong length commit SHA"""
        payload = self.valid_payload.copy()
        payload["repository"]["base_commit_sha"] = "a" * 20  # Too short

        response = self.get_error_response(
            self.organization.slug,
            **payload,
            status_code=400,
        )

        assert "detail" in response.data

    @with_feature("organizations:cli-bug-prediction")
    def test_repository_not_found(self):
        """Test error when repository not found"""
        payload = self.valid_payload.copy()
        payload["repository"]["name"] = "nonexistent-repo"

        response = self.get_error_response(
            self.organization.slug,
            **payload,
            status_code=404,
        )

        assert "not found" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    def test_seer_trigger_timeout(self, mock_trigger):
        """Test handling of Seer trigger timeout"""
        from urllib3.exceptions import TimeoutError

        mock_trigger.side_effect = TimeoutError("Request timed out")

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=503,
        )

        assert "unavailable" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    def test_seer_trigger_error(self, mock_trigger):
        """Test handling of Seer trigger error"""
        mock_trigger.side_effect = ValueError("Seer error")

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=502,
        )

        assert "Failed" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.seer.cli_bug_prediction.get_cli_bug_prediction_status")
    @patch("time.time")
    def test_seer_polling_timeout(self, mock_time, mock_status, mock_trigger):
        """Test handling of polling timeout"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        # Simulate timeout by making time appear to have passed
        mock_time.side_effect = [0, 700]  # Start at 0, then jump to 700 seconds
        mock_status.return_value = {"status": "in_progress"}

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=504,
        )

        assert "exceeded maximum processing time" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.seer.cli_bug_prediction.get_cli_bug_prediction_status")
    def test_seer_error_base_commit_not_found(self, mock_status, mock_trigger):
        """Test mapping of base commit not found error"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        mock_status.return_value = {
            "status": "errored",
            "error_message": "Base commit not found in repository",
        }

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=400,
        )

        assert "pushed to the remote" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.seer.cli_bug_prediction.get_cli_bug_prediction_status")
    def test_seer_error_diff_too_large(self, mock_status, mock_trigger):
        """Test mapping of diff too large error"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        mock_status.return_value = {
            "status": "errored",
            "error_message": "Diff exceeds 500kb limit",
        }

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=400,
        )

        assert "500KB" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.seer.cli_bug_prediction.get_cli_bug_prediction_status")
    def test_seer_error_too_many_files(self, mock_status, mock_trigger):
        """Test mapping of too many files error"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        mock_status.return_value = {
            "status": "errored",
            "error_message": "Diff exceeds 50 files limit",
        }

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=400,
        )

        assert "50 files" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.seer.cli_bug_prediction.get_cli_bug_prediction_status")
    def test_seer_error_clone_failed(self, mock_status, mock_trigger):
        """Test mapping of repository clone failed error"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        mock_status.return_value = {
            "status": "errored",
            "error_message": "Failed to clone repository",
        }

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=502,
        )

        assert "permissions" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.seer.cli_bug_prediction.get_cli_bug_prediction_status")
    def test_seer_error_unknown(self, mock_status, mock_trigger):
        """Test mapping of unknown Seer error"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        mock_status.return_value = {
            "status": "errored",
            "error_message": "Some unknown error",
        }

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=502,
        )

        assert "error" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.ratelimits.backend.is_limited")
    def test_rate_limit_user(self, mock_is_limited):
        """Test user rate limiting"""
        mock_is_limited.side_effect = [True, False]  # User limited, org not

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=429,
        )

        assert "Rate limit exceeded" in response.data["detail"]
        assert "per user" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.ratelimits.backend.is_limited")
    def test_rate_limit_org(self, mock_is_limited):
        """Test organization rate limiting"""
        mock_is_limited.side_effect = [False, True]  # User not limited, org limited

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=429,
        )

        assert "Organization rate limit exceeded" in response.data["detail"]

    @with_feature("organizations:cli-bug-prediction")
    @patch("sentry.seer.cli_bug_prediction.trigger_cli_bug_prediction")
    @patch("sentry.seer.cli_bug_prediction.get_cli_bug_prediction_status")
    def test_optional_fields(self, mock_status, mock_trigger):
        """Test that optional fields are not required"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        mock_status.return_value = {
            "status": "completed",
            "predictions": [],
            "diagnostics": {},
        }

        # Remove optional fields
        payload = {
            "repository": {
                "owner": "getsentry",
                "name": "test-repo",
                "provider": "github",
                "base_commit_sha": "a" * 40,
            },
            "diff": "diff --git a/file.py b/file.py\n+print('hello')\n",
            # No current_branch or commit_message
        }

        response = self.get_success_response(
            self.organization.slug,
            **payload,
            status_code=200,
        )

        assert response.data["status"] == "completed"
