import pytest

from sentry.seer.code_review.utils import _transform_webhook_to_codegen_request
from sentry.testutils.cases import TestCase


class TransformWebhookToCodegenRequestTest(TestCase):
    """Unit tests for _transform_webhook_to_codegen_request."""

    def test_transform_includes_organization_id(self):
        """Test that the transformed payload includes organization_id."""
        event_payload = {
            "action": "opened",
            "pull_request": {"number": 123},
            "repository": {
                "id": 456,
                "name": "test-repo",
                "owner": {"login": "test-owner"},
            },
        }
        organization_id = 789

        result = _transform_webhook_to_codegen_request(
            "pull_request", event_payload, organization_id
        )

        assert result is not None
        assert result["organization_id"] == organization_id
        assert result["request_type"] == "pr-review"
        assert result["external_owner_id"] == "456"
        assert result["data"]["repo"]["name"] == "test-repo"
        assert result["data"]["pr_id"] == 123

    def test_transform_with_issue_comment_on_pr(self):
        """Test that issue_comment events on PRs include organization_id."""
        event_payload = {
            "action": "created",
            "issue": {
                "number": 123,
                "pull_request": {"url": "https://api.github.com/repos/test/repo/pulls/123"},
            },
            "repository": {
                "id": 456,
                "name": "test-repo",
                "owner": {"login": "test-owner"},
            },
        }
        organization_id = 789

        result = _transform_webhook_to_codegen_request(
            "issue_comment", event_payload, organization_id
        )

        assert result is not None
        assert result["organization_id"] == organization_id
        assert result["data"]["pr_id"] == 123

    def test_transform_returns_none_for_non_pr_issue_comment(self):
        """Test that issue_comment events on regular issues return None."""
        event_payload = {
            "action": "created",
            "issue": {
                "number": 123,
                # No pull_request field means it's a regular issue
            },
            "repository": {
                "id": 456,
                "name": "test-repo",
                "owner": {"login": "test-owner"},
            },
        }
        organization_id = 789

        result = _transform_webhook_to_codegen_request(
            "issue_comment", event_payload, organization_id
        )

        assert result is None

    def test_transform_raises_valueerror_for_missing_repository(self):
        """Test that missing repository raises ValueError."""
        event_payload = {
            "action": "opened",
            "pull_request": {"number": 123},
        }
        organization_id = 789

        with pytest.raises(ValueError, match="Missing repository in webhook payload"):
            _transform_webhook_to_codegen_request("pull_request", event_payload, organization_id)
