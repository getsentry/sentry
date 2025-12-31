import pytest

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.seer.code_review.utils import (
    _get_trigger,
    _get_trigger_metadata,
    _transform_webhook_to_codegen_request,
)
from sentry.testutils.factories import Factories
from sentry.users.models.user import User


class TestGetTrigger:
    def test_pull_request_opened(self) -> None:
        assert (
            _get_trigger("pull_request", {"action": "opened"})
            == CodeReviewTrigger.ON_READY_FOR_REVIEW.value
        )

    def test_pull_request_ready_for_review(self) -> None:
        assert (
            _get_trigger("pull_request", {"action": "ready_for_review"})
            == CodeReviewTrigger.ON_READY_FOR_REVIEW.value
        )

    def test_pull_request_synchronize(self) -> None:
        assert (
            _get_trigger("pull_request", {"action": "synchronize"})
            == CodeReviewTrigger.ON_NEW_COMMIT.value
        )

    @pytest.mark.parametrize(
        "event_payload",
        [
            {"action": "closed"},
            {"action": "assigned"},
            {"action": "labeled"},
        ],
    )
    def test_pull_request_other_action_returns_none(self, event_payload: dict[str, str]) -> None:
        assert _get_trigger("pull_request", event_payload) is None

    def test_issue_comment_created(self) -> None:
        assert (
            _get_trigger("issue_comment", {"action": "created"})
            == CodeReviewTrigger.ON_COMMAND_PHRASE.value
        )

    def test_unknown_event_type_returns_none(self) -> None:
        assert _get_trigger("push", {}) is None


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
        result = _transform_webhook_to_codegen_request(
            "pull_request", event_payload, organization, repo, "abc123sha"
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
        result = _transform_webhook_to_codegen_request(
            "issue_comment", event_payload, organization, repo, "def456sha"
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
        result = _transform_webhook_to_codegen_request(
            "issue_comment", event_payload, organization, repo, None
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
            _transform_webhook_to_codegen_request(
                "pull_request",
                event_payload,
                organization,
                bad_repo,
                "sha123",
            )
