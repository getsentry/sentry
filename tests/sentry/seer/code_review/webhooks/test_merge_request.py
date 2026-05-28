from collections.abc import Generator
from unittest.mock import patch

import orjson
import pytest

from fixtures.gitlab import MERGE_REQUEST_OPENED_EVENT, GitLabTestCase
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.code_review.webhooks.merge_request import handle_merge_request_event
from sentry.testutils.helpers.features import with_feature


def _make_event(action: str = "open", **overrides: object) -> dict:
    event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)
    event["object_attributes"]["action"] = action
    for key, value in overrides.items():
        event["object_attributes"][key] = value
    return event


def _rpc_org(org) -> RpcOrganization:
    return RpcOrganization(
        id=org.id,
        slug=org.slug,
        name=org.name,
    )


class MergeRequestEventWebhookTest(GitLabTestCase):
    CODE_REVIEW_FEATURES = {
        "organizations:gen-ai-features",
        "organizations:code-review-beta",
    }

    @pytest.fixture(autouse=True)
    def mock_seer_request(self) -> Generator[None]:
        with patch("sentry.seer.code_review.webhooks.task.make_seer_request") as mock_seer:
            self.mock_seer = mock_seer
            yield

    def _setup_code_review(
        self,
        triggers: list[CodeReviewTrigger] | None = None,
    ) -> None:
        if triggers is None:
            triggers = [
                CodeReviewTrigger.ON_NEW_COMMIT,
                CodeReviewTrigger.ON_READY_FOR_REVIEW,
            ]

        repo = self.create_gitlab_repo(name="cool-group/sentry")

        trigger_values = [t.value for t in triggers]
        self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=trigger_values,
        )

        OrganizationContributors.objects.get_or_create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="51",
            defaults={"alias": "root"},
        )

        self.repo = repo

    def _call_handler(self, event: dict) -> None:
        handle_merge_request_event(
            event=event,
            organization=_rpc_org(self.organization),
            repo=self.repo,
            integration=self.integration,
        )

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_open_uses_review_request_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/review-request"

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_close_uses_pr_closed_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event("close")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/pr-closed"

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_merge_uses_pr_closed_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event("merge")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/pr-closed"

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_update_uses_review_request_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event("update")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/review-request"

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_skips_draft_mr(self) -> None:
        self._setup_code_review()
        event = _make_event("open", draft=True)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_skips_work_in_progress_mr(self) -> None:
        self._setup_code_review()
        event = _make_event("open", work_in_progress=True)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_close_still_sends_for_draft_mr(self) -> None:
        self._setup_code_review()
        event = _make_event("close", draft=True)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_skips_unsupported_action(self) -> None:
        self._setup_code_review()
        event = _make_event("approved")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_skips_unknown_action(self) -> None:
        self._setup_code_review()
        event = _make_event("future_action_not_in_enum")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_skips_missing_action(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        del event["object_attributes"]["action"]

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_skips_when_integration_is_none(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            handle_merge_request_event(
                event=event,
                organization=_rpc_org(self.organization),
                repo=self.repo,
                integration=None,
            )

        self.mock_seer.assert_not_called()

    def test_skips_when_code_review_not_enabled(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_skips_missing_last_commit(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        del event["object_attributes"]["last_commit"]

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_open_filtered_when_trigger_disabled(self) -> None:
        self._setup_code_review(triggers=[CodeReviewTrigger.ON_NEW_COMMIT])
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_update_filtered_when_trigger_disabled(self) -> None:
        self._setup_code_review(triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW])
        event = _make_event("update")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_close_filtered_when_no_triggers_configured(self) -> None:
        self._setup_code_review(triggers=[])
        event = _make_event("close")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_close_sends_when_triggers_configured(self) -> None:
        self._setup_code_review(triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW])
        event = _make_event("close")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_payload_contains_correct_pr_id(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["pr_id"] == 1

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_payload_contains_gitlab_provider(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["repo"]["provider"] == "gitlab"

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_payload_trigger_on_ready_for_review_for_open(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["config"]["trigger"] == "on_ready_for_review"

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_payload_trigger_on_new_commit_for_update(self) -> None:
        self._setup_code_review()
        event = _make_event("update")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["config"]["trigger"] == "on_new_commit"

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_payload_contains_trigger_user_from_event(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["config"]["trigger_user"] == "root"
