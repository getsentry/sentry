from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.seer.code_review.utils import (
    _get_target_commit_sha,
    _get_trigger_metadata,
    transform_webhook_to_codegen_request,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.users.models.user import User


class TestGetTriggerMetadata:
    def test_extracts_comment_info(self) -> None:
        event_payload = {
            "comment": {
                "id": 12345,
                "user": {"login": "test-user"},
            }
        }
        result = _get_trigger_metadata(event_payload)
        assert result["trigger_comment_id"] == 12345
        assert result["trigger_user"] == "test-user"
        assert result["trigger_comment_type"] == "issue_comment"

    def test_extracts_pull_request_review_comment_type(self) -> None:
        event_payload = {
            "comment": {
                "id": 12345,
                "user": {"login": "test-user"},
                "pull_request_review_id": 67890,
            }
        }
        result = _get_trigger_metadata(event_payload)
        assert result["trigger_comment_type"] == "pull_request_review_comment"

    def test_falls_back_to_sender(self) -> None:
        event_payload = {
            "sender": {"login": "sender-user"},
        }
        result = _get_trigger_metadata(event_payload)
        assert result["trigger_user"] == "sender-user"
        assert result["trigger_comment_id"] is None
        assert result["trigger_comment_type"] is None

    def test_falls_back_to_pull_request_user(self) -> None:
        event_payload = {
            "pull_request": {"user": {"login": "pr-author"}},
        }
        result = _get_trigger_metadata(event_payload)
        assert result["trigger_user"] == "pr-author"

    def test_no_data_returns_none_values(self) -> None:
        result = _get_trigger_metadata({})
        assert result["trigger_comment_id"] is None
        assert result["trigger_comment_type"] is None
        assert result["trigger_user"] is None


class GetTargetCommitShaTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project,
            name="test-owner/test-repo",
            provider="integrations:github",
        )

    def test_returns_sha_from_pull_request_payload(self) -> None:
        event = {
            "pull_request": {
                "head": {"sha": "abc123"},
            }
        }
        result = _get_target_commit_sha(GithubWebhookType.PULL_REQUEST, event, self.repo, None)
        assert result == "abc123"

    def test_raises_if_pull_request_head_missing(self) -> None:
        event: dict[str, dict[str, str]] = {"pull_request": {}}
        with pytest.raises(ValueError, match="missing-pr-head-sha"):
            _get_target_commit_sha(GithubWebhookType.PULL_REQUEST, event, self.repo, None)

    @patch("sentry.seer.code_review.utils.GitHubApiClient")
    def test_issue_comment_fetches_sha_from_api(self, mock_client_class: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.get_pull_request.return_value = {"head": {"sha": "def456"}}
        mock_client_class.return_value = mock_client

        mock_integration = MagicMock()
        event = {"issue": {"number": 42}}

        result = _get_target_commit_sha(
            GithubWebhookType.ISSUE_COMMENT, event, self.repo, mock_integration
        )

        assert result == "def456"
        mock_client.get_pull_request.assert_called_once_with("test-owner/test-repo", 42)

    def test_issue_comment_raises_without_integration(self) -> None:
        event = {"issue": {"number": 42}}
        with pytest.raises(ValueError, match="missing-integration-for-sha"):
            _get_target_commit_sha(GithubWebhookType.ISSUE_COMMENT, event, self.repo, None)

    def test_issue_comment_raises_without_issue_number(self) -> None:
        mock_integration = MagicMock()
        event: dict[str, dict[str, int]] = {"issue": {}}
        with pytest.raises(ValueError, match="missing-pr-number-for-sha"):
            _get_target_commit_sha(
                GithubWebhookType.ISSUE_COMMENT, event, self.repo, mock_integration
            )

    @patch("sentry.seer.code_review.utils.GitHubApiClient")
    def test_issue_comment_raises_on_api_error(self, mock_client_class: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.get_pull_request.side_effect = Exception("API error")
        mock_client_class.return_value = mock_client

        mock_integration = MagicMock()
        event = {"issue": {"number": 42}}

        with pytest.raises(Exception, match="API error"):
            _get_target_commit_sha(
                GithubWebhookType.ISSUE_COMMENT, event, self.repo, mock_integration
            )

    def test_raises_for_unknown_event_type(self) -> None:
        event: dict[str, str] = {}
        with pytest.raises(ValueError, match="unsupported-event-for-sha"):
            _get_target_commit_sha(GithubWebhookType.CHECK_RUN, event, self.repo, None)


@pytest.mark.django_db(databases=["default", "control"])
class TestTransformWebhookToCodegenRequest:
    @pytest.fixture
    def setup_entities(
        self,
    ) -> tuple[User, Organization, Project, Repository]:
        owner = Factories.create_user()
        organization = Factories.create_organization(owner=owner, slug="test-org")
        project = Factories.create_project(organization=organization)
        repo = Factories.create_repo(
            project,
            name="test-owner/test-repo",
            provider="integrations:github",
            external_id="123456",
        )
        return owner, organization, project, repo

    def test_pull_request_event(
        self, setup_entities: tuple[User, Organization, Project, Repository]
    ) -> None:
        _, organization, _, repo = setup_entities
        event_payload = {
            "action": "opened",
            "pull_request": {
                "number": 42,
                "user": {"login": "pr-author"},
            },
            "sender": {"login": "sender-user"},
        }
        result = transform_webhook_to_codegen_request(
            GithubWebhookType.PULL_REQUEST,
            event_payload,
            organization,
            repo,
            "abc123sha",
            CodeReviewTrigger.ON_READY_FOR_REVIEW,
        )

        expected_repo = {
            "provider": "github",
            "owner": "test-owner",
            "name": "test-repo",
            "external_id": "123456",
            "base_commit_sha": "abc123sha",
        }

        assert isinstance(result, dict)
        assert result["request_type"] == "pr-review"
        assert result["external_owner_id"] == "123456"
        assert result["data"]["pr_id"] == 42
        repo_data = result["data"]["repo"]
        for k, v in expected_repo.items():
            assert repo_data[k] == v
        assert result["data"]["bug_prediction_specific_information"] == {
            "organization_id": organization.id,
            "organization_slug": organization.slug,
        }
        assert result["data"]["config"] == {
            "features": {"bug_prediction": True},
            "trigger": CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
        } | {k: v for k, v in result["data"]["config"].items() if k not in ("features", "trigger")}

    def test_issue_comment_on_pr(
        self, setup_entities: tuple[User, Organization, Project, Repository]
    ) -> None:
        _, organization, _, repo = setup_entities
        event_payload = {
            "action": "created",
            "issue": {
                "number": 42,
                "pull_request": {
                    "url": "https://api.github.com/repos/test-owner/test-repo/pulls/42"
                },
            },
            "comment": {
                "id": 12345,
                "user": {"login": "commenter"},
            },
        }
        result = transform_webhook_to_codegen_request(
            GithubWebhookType.ISSUE_COMMENT,
            event_payload,
            organization,
            repo,
            "def456sha",
            CodeReviewTrigger.ON_COMMAND_PHRASE,
        )

        assert isinstance(result, dict)
        data = result["data"]
        config = data["config"]
        assert data["pr_id"] == 42
        assert config["trigger"] == CodeReviewTrigger.ON_COMMAND_PHRASE.value
        assert config["trigger_comment_id"] == 12345
        assert config["trigger_user"] == "commenter"
        assert config["trigger_comment_type"] == "issue_comment"

    def test_issue_comment_on_regular_issue_returns_none(
        self, setup_entities: tuple[User, Organization, Project, Repository]
    ) -> None:
        _, organization, _, repo = setup_entities
        event_payload = {
            "action": "created",
            "issue": {"number": 42},
            "comment": {"id": 12345},
        }
        result = transform_webhook_to_codegen_request(
            GithubWebhookType.ISSUE_COMMENT,
            event_payload,
            organization,
            repo,
            "somesha",
            CodeReviewTrigger.ON_COMMAND_PHRASE,
        )
        assert result is None

    def test_invalid_repo_name_format_raises(
        self, setup_entities: tuple[User, Organization, Project, Repository]
    ) -> None:
        _, organization, project, _ = setup_entities
        bad_repo = Factories.create_repo(
            project,
            name="invalid-repo-name",  # Missing owner prefix
            provider="integrations:github",
            external_id="999",
        )
        event_payload = {
            "pull_request": {"number": 1},
        }
        with pytest.raises(ValueError, match="Invalid repository name format"):
            transform_webhook_to_codegen_request(
                GithubWebhookType.PULL_REQUEST,
                event_payload,
                organization,
                bad_repo,
                "sha123",
                CodeReviewTrigger.ON_READY_FOR_REVIEW,
            )
