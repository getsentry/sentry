from unittest.mock import Mock, patch

import pytest
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.seer.cli_bug_prediction import get_cli_bug_prediction_status, trigger_cli_bug_prediction
from sentry.utils import json


@pytest.fixture
def mock_connection_pool():
    """Create a mock connection pool for testing"""
    mock = Mock()
    mock.host = "localhost"
    mock.port = 9091
    mock.scheme = "http"
    return mock


@pytest.mark.django_db
class TestTriggerCliBugPrediction:
    def test_trigger_success(self, mock_connection_pool):
        """Test successful trigger of CLI bug prediction"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = json.dumps({"run_id": 123, "status": "pending"}).encode("utf-8")
        mock_connection_pool.urlopen.return_value = mock_response

        with patch(
            "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
            mock_connection_pool,
        ):
            result = trigger_cli_bug_prediction(
                repo_provider="github",
                repo_owner="getsentry",
                repo_name="sentry",
                repo_external_id="123456",
                base_commit_sha="a" * 40,
                diff="diff --git a/file.py b/file.py\n...",
                organization_id=1,
                organization_slug="test-org",
                user_id=1,
                user_name="test-user",
            )

        assert result["run_id"] == 123
        assert result["status"] == "pending"

    def test_trigger_with_commit_message(self, mock_connection_pool):
        """Test trigger with optional commit message"""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = json.dumps({"run_id": 456, "status": "pending"}).encode("utf-8")
        mock_connection_pool.urlopen.return_value = mock_response

        with patch(
            "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
            mock_connection_pool,
        ):
            result = trigger_cli_bug_prediction(
                repo_provider="github",
                repo_owner="getsentry",
                repo_name="sentry",
                repo_external_id="123456",
                base_commit_sha="b" * 40,
                diff="diff --git a/file.py b/file.py\n...",
                organization_id=1,
                organization_slug="test-org",
                user_id=1,
                user_name="test-user",
                commit_message="Fix bug",
            )

        assert result["run_id"] == 456

    def test_trigger_timeout(self, mock_connection_pool):
        """Test timeout handling"""
        mock_connection_pool.urlopen.side_effect = TimeoutError("Request timed out")

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(TimeoutError),
        ):
            trigger_cli_bug_prediction(
                repo_provider="github",
                repo_owner="getsentry",
                repo_name="sentry",
                repo_external_id="123456",
                base_commit_sha="c" * 40,
                diff="diff --git a/file.py b/file.py\n...",
                organization_id=1,
                organization_slug="test-org",
                user_id=1,
                user_name="test-user",
            )

    def test_trigger_max_retry_error(self, mock_connection_pool):
        """Test max retry error handling"""
        mock_connection_pool.urlopen.side_effect = MaxRetryError(
            pool=mock_connection_pool, url="/test"
        )

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(MaxRetryError),
        ):
            trigger_cli_bug_prediction(
                repo_provider="github",
                repo_owner="getsentry",
                repo_name="sentry",
                repo_external_id="123456",
                base_commit_sha="d" * 40,
                diff="diff --git a/file.py b/file.py\n...",
                organization_id=1,
                organization_slug="test-org",
                user_id=1,
                user_name="test-user",
            )

    def test_trigger_error_response(self, mock_connection_pool):
        """Test handling of error status codes"""
        mock_response = Mock()
        mock_response.status = 500
        mock_response.data = b"Internal server error"
        mock_connection_pool.urlopen.return_value = mock_response

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(ValueError, match="Seer returned error status: 500"),
        ):
            trigger_cli_bug_prediction(
                repo_provider="github",
                repo_owner="getsentry",
                repo_name="sentry",
                repo_external_id="123456",
                base_commit_sha="e" * 40,
                diff="diff --git a/file.py b/file.py\n...",
                organization_id=1,
                organization_slug="test-org",
                user_id=1,
                user_name="test-user",
            )

    def test_trigger_invalid_json_response(self, mock_connection_pool):
        """Test handling of invalid JSON in response"""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = b"not valid json"
        mock_connection_pool.urlopen.return_value = mock_response

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(ValueError, match="Invalid JSON response from Seer"),
        ):
            trigger_cli_bug_prediction(
                repo_provider="github",
                repo_owner="getsentry",
                repo_name="sentry",
                repo_external_id="123456",
                base_commit_sha="f" * 40,
                diff="diff --git a/file.py b/file.py\n...",
                organization_id=1,
                organization_slug="test-org",
                user_id=1,
                user_name="test-user",
            )

    def test_trigger_missing_run_id(self, mock_connection_pool):
        """Test handling of response missing run_id"""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = json.dumps({"status": "pending"}).encode("utf-8")
        mock_connection_pool.urlopen.return_value = mock_response

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(ValueError, match="Missing run_id in Seer response"),
        ):
            trigger_cli_bug_prediction(
                repo_provider="github",
                repo_owner="getsentry",
                repo_name="sentry",
                repo_external_id="123456",
                base_commit_sha="0" * 40,
                diff="diff --git a/file.py b/file.py\n...",
                organization_id=1,
                organization_slug="test-org",
                user_id=1,
                user_name="test-user",
            )


@pytest.mark.django_db
class TestGetCliBugPredictionStatus:
    def test_status_pending(self, mock_connection_pool):
        """Test getting pending status"""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = json.dumps({"status": "pending", "run_id": 123}).encode("utf-8")
        mock_connection_pool.urlopen.return_value = mock_response

        with patch(
            "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
            mock_connection_pool,
        ):
            result = get_cli_bug_prediction_status(run_id=123)

        assert result["status"] == "pending"
        assert result["run_id"] == 123

    def test_status_completed_with_predictions(self, mock_connection_pool):
        """Test getting completed status with predictions"""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = json.dumps(
            {
                "status": "completed",
                "run_id": 123,
                "predictions": [
                    {
                        "location": "file.py#L10",
                        "short_description": "Potential bug",
                        "explanation": "...",
                        "severity": "high",
                        "source": "code",
                    }
                ],
                "diagnostics": {"files_analyzed": 3, "execution_time_seconds": 45.2},
            }
        ).encode("utf-8")
        mock_connection_pool.urlopen.return_value = mock_response

        with patch(
            "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
            mock_connection_pool,
        ):
            result = get_cli_bug_prediction_status(run_id=123)

        assert result["status"] == "completed"
        assert len(result["predictions"]) == 1
        assert result["predictions"][0]["location"] == "file.py#L10"
        assert result["diagnostics"]["files_analyzed"] == 3

    def test_status_timeout(self, mock_connection_pool):
        """Test timeout handling for status check"""
        mock_connection_pool.urlopen.side_effect = TimeoutError("Request timed out")

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(TimeoutError),
        ):
            get_cli_bug_prediction_status(run_id=123)

    def test_status_max_retry_error(self, mock_connection_pool):
        """Test max retry error handling for status check"""
        mock_connection_pool.urlopen.side_effect = MaxRetryError(
            pool=mock_connection_pool, url="/test"
        )

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(MaxRetryError),
        ):
            get_cli_bug_prediction_status(run_id=123)

    def test_status_error_response(self, mock_connection_pool):
        """Test handling of error status codes for status check"""
        mock_response = Mock()
        mock_response.status = 404
        mock_response.data = b"Not found"
        mock_connection_pool.urlopen.return_value = mock_response

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(ValueError, match="Seer returned error status: 404"),
        ):
            get_cli_bug_prediction_status(run_id=123)

    def test_status_invalid_json_response(self, mock_connection_pool):
        """Test handling of invalid JSON in status response"""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = b"not valid json"
        mock_connection_pool.urlopen.return_value = mock_response

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(ValueError, match="Invalid JSON response from Seer"),
        ):
            get_cli_bug_prediction_status(run_id=123)

    def test_status_missing_status_field(self, mock_connection_pool):
        """Test handling of response missing status field"""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = json.dumps({"run_id": 123}).encode("utf-8")
        mock_connection_pool.urlopen.return_value = mock_response

        with (
            patch(
                "sentry.seer.cli_bug_prediction.seer_cli_bug_prediction_connection_pool",
                mock_connection_pool,
            ),
            pytest.raises(ValueError, match="Missing status in Seer response"),
        ):
            get_cli_bug_prediction_status(run_id=123)
