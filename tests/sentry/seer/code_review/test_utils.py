from datetime import datetime
from unittest.mock import MagicMock

import orjson
import pytest

from fixtures.github import (
    CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
    CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
    PULL_REQUEST_OPENED_EVENT_EXAMPLE,
)
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
    extract_github_info,
    is_org_enabled_for_code_review_experiments,
    transform_webhook_to_codegen_request,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.users.models.user import User
from sentry.utils import json


class TestGetTriggerMetadata:
    def test_extracts_issue_comment_info(self) -> None:
        event_payload = {
            "comment": {
                "id": 12345,
                "user": {"login": "test-user", "id": 99999},
                "updated_at": "2024-01-15T10:30:00Z",
            }
        }
        result = _get_trigger_metadata_for_issue_comment(event_payload)
        assert result["trigger_comment_id"] == 12345
        assert result["trigger_user"] == "test-user"
        assert result["trigger_user_id"] == 99999
        assert result["trigger_comment_type"] == "issue_comment"
        assert result["trigger_at"] == "2024-01-15T10:30:00Z"

    def test_extracts_issue_comment_trigger_at_defaults_to_now_when_missing(self) -> None:
        event_payload = {
            "comment": {
                "id": 12345,
                "user": {"login": "test-user", "id": 99999},
            }
        }
        result = _get_trigger_metadata_for_issue_comment(event_payload)
        # Returns ISO string for Celery serialization
        assert isinstance(result["trigger_at"], str)
        # Verify it's a valid ISO datetime string
        datetime.fromisoformat(result["trigger_at"])

    def test_issue_comment_falls_back_to_created_at(self) -> None:
        event_payload = {
            "comment": {
                "id": 12345,
                "user": {"login": "test-user", "id": 99999},
                "created_at": "2024-01-15T09:00:00Z",
            }
        }
        result = _get_trigger_metadata_for_issue_comment(event_payload)
        assert result["trigger_at"] == "2024-01-15T09:00:00Z"

    def test_pull_request_uses_sender_rather_than_pr_author(self) -> None:
        event_payload = {
            "sender": {"login": "sender-user", "id": 12345},
            "pull_request": {
                "user": {"login": "pr-author", "id": 67890},
                "updated_at": "2024-01-15T11:00:00Z",
            },
        }
        result = _get_trigger_metadata_for_pull_request(event_payload)
        assert result["trigger_user"] == "sender-user"
        assert result["trigger_user_id"] == 12345
        assert result["trigger_comment_id"] is None
        assert result["trigger_comment_type"] is None
        assert result["trigger_at"] == "2024-01-15T11:00:00Z"

    def test_pull_request_falls_back_to_pr_user(self) -> None:
        event_payload = {
            "pull_request": {
                "user": {"login": "pr-author", "id": 67890},
                "updated_at": "2024-01-15T12:00:00Z",
            },
        }
        result = _get_trigger_metadata_for_pull_request(event_payload)
        assert result["trigger_user"] == "pr-author"
        assert result["trigger_user_id"] == 67890
        assert result["trigger_comment_id"] is None
        assert result["trigger_comment_type"] is None
        assert result["trigger_at"] == "2024-01-15T12:00:00Z"

    def test_pull_request_no_data_defaults_trigger_at_to_now(self) -> None:
        result = _get_trigger_metadata_for_pull_request({})
        assert result["trigger_comment_id"] is None
        assert result["trigger_comment_type"] is None
        assert result["trigger_user"] is None
        assert result["trigger_user_id"] is None
        # Returns ISO string for Celery serialization
        assert isinstance(result["trigger_at"], str)
        # Verify it's a valid ISO datetime string
        datetime.fromisoformat(result["trigger_at"])


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
                "updated_at": "2024-01-15T10:30:00Z",
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
        assert result["data"]["config"]["features"] == {"bug_prediction": True}
        assert (
            result["data"]["config"]["trigger"] == SeerCodeReviewTrigger.ON_READY_FOR_REVIEW.value
        )
        assert result["data"]["config"]["trigger_at"] == "2024-01-15T10:30:00Z"
        # sentry_received_trigger_at is set to current time when transform happens
        assert isinstance(result["data"]["config"]["sentry_received_trigger_at"], str)
        datetime.fromisoformat(result["data"]["config"]["sentry_received_trigger_at"])

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
                "updated_at": "2024-01-15T14:00:00Z",
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
        assert config["trigger_at"] == "2024-01-15T14:00:00Z"
        # sentry_received_trigger_at is set to current time when transform happens
        assert isinstance(config["sentry_received_trigger_at"], str)
        datetime.fromisoformat(config["sentry_received_trigger_at"])

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

    def test_pull_request_payload_is_json_serializable(
        self, setup_entities: tuple[User, Organization, Project, Repository]
    ) -> None:
        """Verify payload can be JSON serialized for Celery task submission."""
        _, organization, _, repo = setup_entities
        event_payload = {
            "action": "opened",
            "pull_request": {
                "number": 42,
                "user": {"login": "pr-author"},
                "updated_at": "2024-01-15T10:30:00Z",
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

        # This would fail if trigger_at is a datetime object instead of string
        json.dumps(result)  # Should not raise TypeError

    def test_issue_comment_payload_is_json_serializable(
        self, setup_entities: tuple[User, Organization, Project, Repository]
    ) -> None:
        """Verify payload can be JSON serialized for Celery task submission."""
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
                "updated_at": "2024-01-15T14:00:00Z",
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

        # This would fail if trigger_at is a datetime object instead of string
        json.dumps(result)  # Should not raise TypeError


class TestExtractGithubInfo:
    def test_extract_from_pull_request_event(self) -> None:
        event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
        result = extract_github_info(event, github_event="pull_request")

        assert result["github_owner"] == "baxterthehacker"
        assert result["github_repo_name"] == "public-repo"
        assert result["github_repo_full_name"] == "baxterthehacker/public-repo"
        assert result["github_event_url"] == "https://github.com/baxterthehacker/public-repo/pull/1"
        assert result["github_event"] == "pull_request"
        assert result["github_event_action"] == "opened"
        assert result["github_actor_login"] == "baxterthehacker"
        assert result["github_actor_id"] == "6752317"

    def test_extract_from_check_run_event(self) -> None:
        event = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        result = extract_github_info(event, github_event="check_run")

        assert result["github_owner"] == "getsentry"
        assert result["github_repo_name"] == "sentry"
        assert result["github_repo_full_name"] == "getsentry/sentry"
        assert result["github_event_url"] == "https://github.com/getsentry/sentry/runs/4"
        assert result["github_event"] == "check_run"
        assert result["github_event_action"] == "rerequested"
        assert result["github_actor_login"] == "test-user"
        assert result["github_actor_id"] == "12345678"

    def test_extract_from_check_run_completed_event(self) -> None:
        event = orjson.loads(CHECK_RUN_COMPLETED_EVENT_EXAMPLE)
        result = extract_github_info(event, github_event="check_run")

        assert result["github_owner"] == "getsentry"
        assert result["github_repo_name"] == "sentry"
        assert result["github_repo_full_name"] == "getsentry/sentry"
        assert result["github_event_url"] == "https://github.com/getsentry/sentry/runs/9876543"
        assert result["github_event"] == "check_run"
        assert result["github_event_action"] == "completed"
        assert result["github_actor_login"] == "test-user"
        assert result["github_actor_id"] == "12345678"

    def test_extract_from_issue_comment_event(self) -> None:
        event = {
            "action": "created",
            "repository": {
                "name": "comment-repo",
                "full_name": "comment-owner/comment-repo",
                "owner": {"login": "comment-owner"},
            },
            "issue": {
                "number": 42,
                "pull_request": {
                    "html_url": "https://github.com/comment-owner/comment-repo/pull/42"
                },
            },
            "comment": {
                "html_url": "https://github.com/comment-owner/comment-repo/pull/42#issuecomment-123456",
                "id": 123456,
            },
            "sender": {
                "login": "commenter-user",
                "id": 98765,
            },
        }
        result = extract_github_info(event, github_event="issue_comment")

        assert result["github_owner"] == "comment-owner"
        assert result["github_repo_name"] == "comment-repo"
        assert result["github_repo_full_name"] == "comment-owner/comment-repo"
        assert (
            result["github_event_url"]
            == "https://github.com/comment-owner/comment-repo/pull/42#issuecomment-123456"
        )
        assert result["github_event"] == "issue_comment"
        assert result["github_event_action"] == "created"
        assert result["github_actor_login"] == "commenter-user"
        assert result["github_actor_id"] == "98765"

    def test_comment_url_takes_precedence_over_pr_url(self) -> None:
        event = {
            "action": "created",
            "pull_request": {"html_url": "https://github.com/owner/repo/pull/1"},
            "comment": {"html_url": "https://github.com/owner/repo/pull/1#issuecomment-999"},
        }
        result = extract_github_info(event)

        assert result["github_event_url"] == "https://github.com/owner/repo/pull/1#issuecomment-999"
        assert result["github_event_action"] == "created"

    def test_check_run_url_takes_precedence_over_pr_url(self) -> None:
        event = {
            "action": "completed",
            "pull_request": {"html_url": "https://github.com/owner/repo/pull/1"},
            "check_run": {"html_url": "https://github.com/owner/repo/runs/123"},
        }
        result = extract_github_info(event)

        assert result["github_event_url"] == "https://github.com/owner/repo/runs/123"
        assert result["github_event_action"] == "completed"

    def test_issue_pr_fallback_for_event_url(self) -> None:
        event = {
            "action": "opened",
            "issue": {"pull_request": {"html_url": "https://github.com/owner/repo/pull/5"}},
        }
        result = extract_github_info(event)

        assert result["github_event_url"] == "https://github.com/owner/repo/pull/5"
        assert result["github_event_action"] == "opened"

    def test_issue_pr_does_not_override_existing_event_url(self) -> None:
        event = {
            "action": "rerequested",
            "check_run": {"html_url": "https://github.com/owner/repo/runs/999"},
            "issue": {"pull_request": {"html_url": "https://github.com/owner/repo/pull/1"}},
        }
        result = extract_github_info(event)

        assert result["github_event_url"] == "https://github.com/owner/repo/runs/999"
        assert result["github_event_action"] == "rerequested"

    def test_empty_event_returns_all_none(self) -> None:
        result = extract_github_info({})

        assert result["github_owner"] is None
        assert result["github_repo_name"] is None
        assert result["github_repo_full_name"] is None
        assert result["github_event_url"] is None
        assert result["github_event"] is None
        assert result["github_event_action"] is None
        assert result["github_actor_login"] is None
        assert result["github_actor_id"] is None

    def test_missing_repository_owner_returns_none(self) -> None:
        event = {"repository": {"name": "repo-without-owner"}}
        result = extract_github_info(event)

        assert result["github_owner"] is None
        assert result["github_repo_name"] == "repo-without-owner"
        assert result["github_repo_full_name"] is None

    def test_missing_html_urls_returns_none(self) -> None:
        event = {
            "repository": {
                "name": "test-repo",
                "owner": {"login": "test-owner"},
            },
            "pull_request": {"number": 1},
            "check_run": {"id": 123},
            "comment": {"id": 456},
        }
        result = extract_github_info(event)

        assert result["github_owner"] == "test-owner"
        assert result["github_repo_name"] == "test-repo"
        assert result["github_event_url"] is None

    def test_issue_without_pull_request_link_returns_comment_url(self) -> None:
        event = {
            "action": "created",
            "issue": {"number": 42},
            "comment": {"html_url": "https://github.com/owner/repo/issues/42#comment"},
        }
        result = extract_github_info(event)

        assert result["github_event_url"] == "https://github.com/owner/repo/issues/42#comment"
        assert result["github_event_action"] == "created"

    def test_repository_with_full_name(self) -> None:
        event = {
            "repository": {
                "name": "my-repo",
                "full_name": "my-org/my-repo",
                "owner": {"login": "my-org"},
            }
        }
        result = extract_github_info(event)

        assert result["github_owner"] == "my-org"
        assert result["github_repo_name"] == "my-repo"
        assert result["github_repo_full_name"] == "my-org/my-repo"

    def test_repository_without_full_name(self) -> None:
        event = {
            "repository": {
                "name": "solo-repo",
                "owner": {"login": "solo-owner"},
            }
        }
        result = extract_github_info(event)

        assert result["github_owner"] == "solo-owner"
        assert result["github_repo_name"] == "solo-repo"
        assert result["github_repo_full_name"] is None


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


class CodeReviewExperimentAssignmentTest(TestCase):

    def test_enabled(self) -> None:
        org = self.create_organization(slug="test-org")
        with self.feature("organizations:code-review-experiments-enabled"):
            assert is_org_enabled_for_code_review_experiments(org)

    def test_disabled(self) -> None:
        org = self.create_organization(slug="test-org")
        assert not is_org_enabled_for_code_review_experiments(org)
