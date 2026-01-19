from unittest.mock import patch

import pytest
from django.test import override_settings

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@pytest.mark.django_db
class OrganizationCodeReviewLocalTest(APITestCase):
    endpoint = "sentry-api-0-organization-code-review-local"
    method = "post"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.repository = self.create_repo(
            project=self.project,
            name="getsentry/test-repo",
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
            "current_branch": "feature/test",
            "commit_message": "Add feature",
        }
        self.login_as(user=self.user)

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.get_code_review_local_status")
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

    @with_feature("organizations:code-review-local")
    @override_settings(CODE_REVIEW_LOCAL_ENABLED=False)
    def test_killswitch_disabled(self):
        """Test that request fails when killswitch is disabled"""
        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=503,
        )

        assert "not enabled" in response.data["detail"]

    @with_feature("organizations:code-review-local")
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

    @with_feature("organizations:code-review-local")
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

    @with_feature("organizations:code-review-local")
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

    @with_feature("organizations:code-review-local")
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

    @with_feature("organizations:code-review-local")
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

    @with_feature("organizations:code-review-local")
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

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
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

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    def test_seer_trigger_error(self, mock_trigger):
        """Test handling of Seer trigger error"""
        mock_trigger.side_effect = ValueError("Seer error")

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=502,
        )

        assert "error" in response.data["detail"].lower()

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.get_code_review_local_status")
    @patch("sentry.seer.code_review.endpoints.code_review_local.time")
    def test_seer_polling_timeout(self, mock_time_module, mock_status, mock_trigger):
        """Test handling of polling timeout"""
        mock_trigger.return_value = {"run_id": 123, "status": "pending"}
        # Simulate timeout: first call returns 0 (start_time), second returns 700 (elapsed > 600)
        call_count = [0]

        def fake_time():
            call_count[0] += 1
            if call_count[0] == 1:
                return 0  # start_time
            return 700  # elapsed check - past timeout

        mock_time_module.time.side_effect = fake_time
        mock_time_module.sleep = lambda x: None  # Don't actually sleep
        mock_status.return_value = {"status": "in_progress"}

        response = self.get_error_response(
            self.organization.slug,
            **self.valid_payload,
            status_code=504,
        )

        assert "exceeded maximum processing time" in response.data["detail"]

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.get_code_review_local_status")
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

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.get_code_review_local_status")
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

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.get_code_review_local_status")
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

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.get_code_review_local_status")
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

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.get_code_review_local_status")
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

    @with_feature("organizations:code-review-local")
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

    @with_feature("organizations:code-review-local")
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

    @with_feature("organizations:code-review-local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.trigger_code_review_local")
    @patch("sentry.seer.code_review.endpoints.code_review_local.get_code_review_local_status")
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
