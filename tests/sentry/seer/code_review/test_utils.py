from unittest.mock import MagicMock

import pytest

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.seer.code_review.models import SeerCodeReviewTrigger
from sentry.seer.code_review.utils import (
    _get_target_commit_sha,
    _get_trigger_metadata_for_issue_comment,
    _get_trigger_metadata_for_pull_request,
    convert_enum_keys_to_strings,
    transform_webhook_to_codegen_request,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.users.models.user import User


class TestGetTriggerMetadata:
    def test_extracts_issue_comment_info(self) -> None:
        event_payload = {
            "comment": {
                "id": 12345,
                "user": {"login": "test-user", "id": 99999},
            }
        }
        result = _get_trigger_metadata_for_issue_comment(event_payload)
        assert result["trigger_comment_id"] == 12345
        assert result["trigger_user"] == "test-user"
        assert result["trigger_user_id"] == 99999
        assert result["trigger_comment_type"] == "issue_comment"

    def test_pull_request_uses_sender_rather_than_pr_author(self) -> None:
        event_payload = {
            "sender": {"login": "sender-user", "id": 12345},
            "pull_request": {"user": {"login": "pr-author", "id": 67890}},
        }
        result = _get_trigger_metadata_for_pull_request(event_payload)
        assert result["trigger_user"] == "sender-user"
        assert result["trigger_user_id"] == 12345
        assert result["trigger_comment_id"] is None
        assert result["trigger_comment_type"] is None

    def test_pull_request_falls_back_to_pr_user(self) -> None:
        event_payload = {
            "pull_request": {"user": {"login": "pr-author", "id": 67890}},
        }
        result = _get_trigger_metadata_for_pull_request(event_payload)
        assert result["trigger_user"] == "pr-author"
        assert result["trigger_user_id"] == 67890
        assert result["trigger_comment_id"] is None
        assert result["trigger_comment_type"] is None

    def test_pull_request_no_data_returns_none_values(self) -> None:
        result = _get_trigger_metadata_for_pull_request({})
        assert result["trigger_comment_id"] is None
        assert result["trigger_comment_type"] is None
        assert result["trigger_user"] is None
        assert result["trigger_user_id"] is None


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

    def test_issue_comment_fetches_sha_from_api(self) -> None:
        mock_client = MagicMock()
        mock_client.get_pull_request.return_value = {"head": {"sha": "def456"}}

        mock_installation = MagicMock()
        mock_installation.get_client.return_value = mock_client

        mock_integration = MagicMock()
        mock_integration.get_installation.return_value = mock_installation

        event = {"issue": {"number": 42}}

        result = _get_target_commit_sha(
            GithubWebhookType.ISSUE_COMMENT, event, self.repo, mock_integration
        )

        assert result == "def456"
        mock_integration.get_installation.assert_called_once_with(
            organization_id=self.repo.organization_id
        )
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

    def test_issue_comment_raises_on_api_error(self) -> None:
        mock_client = MagicMock()
        mock_client.get_pull_request.side_effect = Exception("API error")

        mock_installation = MagicMock()
        mock_installation.get_client.return_value = mock_client

        mock_integration = MagicMock()
        mock_integration.get_installation.return_value = mock_installation

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
        repo.integration_id = 99999
        repo.save()
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
            "opened",
            event_payload,
            organization,
            repo,
            "abc123sha",
        )

        expected_repo = {
            "provider": "github",
            "owner": "test-owner",
            "name": "test-repo",
            "external_id": "123456",
            "base_commit_sha": "abc123sha",
            "organization_id": organization.id,
        }
        expected_repo["integration_id"] = str(repo.integration_id)

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
            "trigger": SeerCodeReviewTrigger.ON_READY_FOR_REVIEW.value,
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
            "created",
            event_payload,
            organization,
            repo,
            "def456sha",
        )

        assert isinstance(result, dict)
        data = result["data"]
        config = data["config"]
        assert data["pr_id"] == 42
        assert data["repo"]["organization_id"] == organization.id
        assert data["repo"]["integration_id"] == str(repo.integration_id)
        assert config["trigger"] == SeerCodeReviewTrigger.ON_COMMAND_PHRASE.value
        assert config["trigger_comment_id"] == 12345
        assert config["trigger_user"] == "commenter"
        assert config["trigger_comment_type"] == "issue_comment"

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
                "opened",
                event_payload,
                organization,
                bad_repo,
                "sha123",
            )

    def test_integration_id_not_included_when_none(
        self, setup_entities: tuple[User, Organization, Project, Repository]
    ) -> None:
        _, organization, project, _ = setup_entities
        repo_without_integration = Factories.create_repo(
            project,
            name="test-owner/test-repo-no-integration",
            provider="integrations:github",
            external_id="222222",
        )
        # Ensure integration_id is None
        repo_without_integration.integration_id = None
        repo_without_integration.save()

        event_payload = {
            "pull_request": {"number": 1},
            "sender": {"login": "test-user"},
        }
        result = transform_webhook_to_codegen_request(
            GithubWebhookType.PULL_REQUEST,
            "opened",
            event_payload,
            organization,
            repo_without_integration,
            "sha123",
        )

        assert result is not None
        assert "integration_id" not in result["data"]["repo"]


class TestConvertEnumKeysToStrings:
    """Tests for the convert_enum_keys_to_strings utility function."""

    def test_converts_enum_keys_in_dict(self) -> None:
        """Test that enum keys in dictionaries are converted to their string values."""
        from enum import Enum

        class TestEnum(Enum):
            KEY1 = "key1"
            KEY2 = "key2"

        input_dict = {TestEnum.KEY1: "value1", TestEnum.KEY2: "value2"}
        result = convert_enum_keys_to_strings(input_dict)

        assert result == {"key1": "value1", "key2": "value2"}
        assert all(isinstance(k, str) for k in result.keys())

    def test_converts_enum_values(self) -> None:
        """Test that enum values are converted to their string values."""
        from enum import Enum

        class TestEnum(Enum):
            VALUE1 = "value1"
            VALUE2 = "value2"

        input_dict = {"key1": TestEnum.VALUE1, "key2": TestEnum.VALUE2}
        result = convert_enum_keys_to_strings(input_dict)

        assert result == {"key1": "value1", "key2": "value2"}

    def test_handles_nested_structures(self) -> None:
        """Test that nested dictionaries and lists are processed recursively."""
        from enum import Enum

        class TestEnum(Enum):
            KEY1 = "key1"
            VALUE1 = "value1"

        input_data = {
            "top_level": {
                TestEnum.KEY1: "nested_value",
                "nested_list": [TestEnum.VALUE1, {"inner_key": TestEnum.VALUE1}],
            }
        }
        result = convert_enum_keys_to_strings(input_data)

        assert result == {
            "top_level": {
                "key1": "nested_value",
                "nested_list": ["value1", {"inner_key": "value1"}],
            }
        }

    def test_preserves_non_enum_values(self) -> None:
        """Test that non-enum values are preserved unchanged."""
        input_dict = {
            "string_key": "string_value",
            "int_key": 123,
            "bool_key": True,
            "none_key": None,
            "list_key": [1, 2, 3],
        }
        result = convert_enum_keys_to_strings(input_dict)

        assert result == input_dict

    def test_handles_seer_code_review_feature_enum(self) -> None:
        """Test with the actual SeerCodeReviewFeature enum used in the codebase."""
        from sentry.seer.code_review.models import SeerCodeReviewFeature

        input_dict = {
            SeerCodeReviewFeature.BUG_PREDICTION: True,
        }
        result = convert_enum_keys_to_strings(input_dict)

        assert result == {"bug_prediction": True}
        assert isinstance(list(result.keys())[0], str)
