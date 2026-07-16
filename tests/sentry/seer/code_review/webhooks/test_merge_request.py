from collections.abc import Generator
from typing import Any
from unittest.mock import ANY, MagicMock, patch

import orjson
import pytest
from pydantic import ValidationError
from scm.types import CreatePullRequestCommentReactionProtocol

from fixtures.gitlab import (
    MERGE_REQUEST_NOTE_EVENT,
    MERGE_REQUEST_OPENED_EVENT,
    GitLabTestCase,
)
from sentry.integrations.utils.hostname import instance_hostname
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.code_review.models import SeerCodeReviewTaskRequestForPrReview
from sentry.seer.code_review.webhooks.merge_request import (
    WEBHOOK_NOTE_SEEN_KEY_PREFIX,
    WEBHOOK_SEEN_KEY_PREFIX,
    handle_merge_request_event,
    handle_merge_request_note_event,
)
from sentry.testutils.helpers.features import with_feature
from sentry.utils.redis import redis_clusters


def _make_event(action: str = "open", **overrides: object) -> dict[str, Any]:
    event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)
    event["object_attributes"]["action"] = action
    # GitLab sends "changes" as a top-level payload field; everything else here
    # (oldrev, draft, work_in_progress, last_commit, ...) lives in object_attributes.
    if "changes" in overrides:
        event["changes"] = overrides.pop("changes")
    for key, value in overrides.items():
        event["object_attributes"][key] = value
    return event


def _rpc_org(org: Organization) -> RpcOrganization:
    return RpcOrganization(
        id=org.id,
        slug=org.slug,
        name=org.name,
    )


class _FakeScmClient:
    """Spec for the SCM reaction methods the handler invokes.

    Used as a ``MagicMock(spec=...)`` so the mock satisfies the runtime-checkable
    SCM capability protocols the handler guards on. A bare ``MagicMock`` does not:
    Python's protocol ``isinstance`` check uses ``inspect.getattr_static``, which
    bypasses ``MagicMock.__getattr__``. The real provider-backed facade exposes
    these as concrete class attributes, so it passes the same guard in production.
    """

    def get_authenticated_actor(self) -> Any: ...

    def get_pull_request_reactions(self, *args: Any, **kwargs: Any) -> Any: ...

    def create_pull_request_reaction(self, *args: Any, **kwargs: Any) -> Any: ...

    def delete_pull_request_reaction(self, *args: Any, **kwargs: Any) -> Any: ...


class _MergeRequestHandlerTestBase(GitLabTestCase):
    """Shared setup for the GitLab merge-request handler tests.

    ``mock_scm`` is autouse so that *every* handler test is isolated from the SCM
    library: the handler now calls ``scm_factory.new`` for every non-close action
    that schedules a review, and without this patch those tests would build a real
    provider and issue (swallowed) HTTP requests to the integration's base URL.
    """

    CODE_REVIEW_FEATURES = {
        "organizations:gen-ai-features",
        "organizations:code-review-beta",
        "organizations:seer-gitlab-support",
    }

    @pytest.fixture(autouse=True)
    def mock_seer_request(self) -> Generator[None]:
        with patch("sentry.seer.code_review.webhooks.task.make_seer_request") as mock_seer:
            self.mock_seer = mock_seer
            yield

    @pytest.fixture(autouse=True)
    def mock_scm(self) -> Generator[None]:
        """Patch scm_factory.new to return a mock SCM and expose the action spies.

        Ids are strings to match the real provider contract (``ResourceId = str``);
        ``map_author`` / ``map_reaction_result`` coerce GitLab's numeric ids to str.
        """
        mock_scm_instance = MagicMock(spec=_FakeScmClient)
        # get_authenticated_actor → ActionResult[Author]
        mock_scm_instance.get_authenticated_actor.return_value = {
            "data": {"id": "42", "username": "sentry-bot"},
            "type": "gitlab",
            "raw": {},
            "meta": {},
        }
        # get_pull_request_reactions → PaginatedActionResult[list[ReactionResult]]
        mock_scm_instance.get_pull_request_reactions.return_value = {
            "data": [],
            "type": "gitlab",
            "raw": {},
            "meta": {"page_info": {}},
        }
        with patch(
            "sentry.seer.code_review.webhooks.merge_request.scm_factory.new",
            return_value=mock_scm_instance,
        ):
            self.mock_scm = mock_scm_instance
            yield

    def _setup_code_review(
        self,
        triggers: list[CodeReviewTrigger] | None = None,
        name: str = "Cool Group / Sentry",
        path: str = "cool-group/sentry",
    ) -> None:
        if triggers is None:
            triggers = [
                CodeReviewTrigger.ON_NEW_COMMIT,
                CodeReviewTrigger.ON_READY_FOR_REVIEW,
            ]

        # GitLab stores Repository.name as the display "name_with_namespace"; the
        # URL slug used to address the project lives in config["path"].
        repo = self.create_gitlab_repo(name=name)
        repo.config["path"] = path
        repo.save()

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
            defaults={
                "alias": "root",
                "provider": self.integration.provider,
                "hostname": instance_hostname(self.integration),
            },
        )

        self.repo = repo

    def _call_handler(self, event: dict[str, Any]) -> None:
        handle_merge_request_event(
            event=event,
            organization=_rpc_org(self.organization),
            repo=self.repo,
            integration=self.integration,
        )


class MergeRequestEventWebhookTest(_MergeRequestHandlerTestBase):
    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_open_uses_review_request_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/review-request"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_validation_failure_is_captured_and_review_dropped(self) -> None:
        # A payload that fails SeerCodeReviewTaskRequest validation means the
        # review is dropped entirely and never reaches Seer, so it must be
        # escalated via sentry_sdk.capture_exception (not just debug-logged).
        self._setup_code_review()
        event = _make_event("open")

        with pytest.raises(ValidationError) as exc_info:
            SeerCodeReviewTaskRequestForPrReview.parse_obj({})
        validation_error = exc_info.value

        with (
            patch(
                "sentry.seer.code_review.webhooks.merge_request."
                "SeerCodeReviewTaskRequestForPrReview.parse_obj",
                side_effect=validation_error,
            ),
            patch(
                "sentry.seer.code_review.webhooks.merge_request.sentry_sdk.capture_exception"
            ) as mock_capture,
            self.tasks(),
        ):
            self._call_handler(event)

        mock_capture.assert_called_once_with(
            validation_error,
            level="warning",
            contexts={"code_review_validation": {"seer_path": ANY}},
        )
        self.mock_seer.assert_not_called()

    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_skips_when_gitlab_flag_disabled(self) -> None:
        # The GitLab MR handler is gated on organizations:seer-gitlab-support,
        # independent of the other code-review flags.
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_close_uses_pr_closed_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event("close")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/pr-closed"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_merge_uses_pr_closed_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event("merge")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/pr-closed"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_update_uses_review_request_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event("update", oldrev="0" * 40)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/review-request"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_update_without_oldrev_is_skipped(self) -> None:
        self._setup_code_review()
        event = _make_event("update")
        assert "oldrev" not in event["object_attributes"]

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_update_with_unrelated_changes_is_skipped(self) -> None:
        # An "update" that only edits metadata (no new commit, no un-draft) must not
        # trigger a review.
        self._setup_code_review()
        event = _make_event("update", changes={"title": {"previous": "a", "current": "b"}})

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_undraft_update_uses_review_request_endpoint(self) -> None:
        # GitLab has no "ready_for_review" action; un-drafting arrives as an "update"
        # whose changes flip draft -> false, and must be treated as ready-for-review.
        self._setup_code_review()
        event = _make_event("update", changes={"draft": {"previous": True, "current": False}})
        assert "oldrev" not in event["object_attributes"]
        # GitLab delivers "changes" at the top level, not under object_attributes.
        assert "changes" in event and "changes" not in event["object_attributes"]

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        assert self.mock_seer.call_args[1]["path"] == "/v1/code_review/review-request"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_undraft_update_via_work_in_progress_uses_review_request_endpoint(self) -> None:
        self._setup_code_review()
        event = _make_event(
            "update", changes={"work_in_progress": {"previous": True, "current": False}}
        )

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        assert self.mock_seer.call_args[1]["path"] == "/v1/code_review/review-request"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_undraft_update_trigger_is_ready_for_review(self) -> None:
        self._setup_code_review()
        event = _make_event("update", changes={"draft": {"previous": True, "current": False}})

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        payload = self.mock_seer.call_args[1]["payload"]
        assert payload["data"]["config"]["trigger"] == "on_ready_for_review"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_undraft_update_filtered_when_ready_trigger_disabled(self) -> None:
        # An un-draft maps to ON_READY_FOR_REVIEW, so a repo that only enabled
        # ON_NEW_COMMIT must not get a review for it.
        self._setup_code_review(triggers=[CodeReviewTrigger.ON_NEW_COMMIT])
        event = _make_event("update", changes={"draft": {"previous": True, "current": False}})

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_skips_draft_mr(self) -> None:
        self._setup_code_review()
        event = _make_event("open", draft=True)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_skips_work_in_progress_mr(self) -> None:
        self._setup_code_review()
        event = _make_event("open", work_in_progress=True)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_close_still_sends_for_draft_mr(self) -> None:
        self._setup_code_review()
        event = _make_event("close", draft=True)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_skips_unsupported_action(self) -> None:
        self._setup_code_review()
        event = _make_event("approved")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_skips_unknown_action(self) -> None:
        self._setup_code_review()
        event = _make_event("future_action_not_in_enum")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_skips_missing_action(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        del event["object_attributes"]["action"]

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
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

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_skips_missing_last_commit(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        del event["object_attributes"]["last_commit"]

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_open_filtered_when_trigger_disabled(self) -> None:
        self._setup_code_review(triggers=[CodeReviewTrigger.ON_NEW_COMMIT])
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_update_filtered_when_trigger_disabled(self) -> None:
        self._setup_code_review(triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW])
        event = _make_event("update", oldrev="0" * 40)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_close_filtered_when_no_triggers_configured(self) -> None:
        self._setup_code_review(triggers=[])
        event = _make_event("close")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_close_sends_when_triggers_configured(self) -> None:
        self._setup_code_review(triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW])
        event = _make_event("close")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_contains_correct_pr_id(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["pr_id"] == 1

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_contains_gitlab_provider(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["repo"]["provider"] == "gitlab"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_owner_and_name_use_path_not_display_name(self) -> None:
        # Repository.name is the display "Cool Group / Sentry"; Seer must receive
        # the URL slugs derived from config["path"] ("cool-group/sentry").
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        repo = self.mock_seer.call_args[1]["payload"]["data"]["repo"]
        assert repo["owner"] == "cool-group"
        assert repo["name"] == "sentry"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_owner_and_name_handle_subgroups(self) -> None:
        self._setup_code_review(name="Group / Subgroup / Project", path="group/subgroup/project")
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        repo = self.mock_seer.call_args[1]["payload"]["data"]["repo"]
        assert repo["owner"] == "group"
        assert repo["name"] == "subgroup/project"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_is_private_true_for_private_project(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        event["project"]["visibility_level"] = 0

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        repo = self.mock_seer.call_args[1]["payload"]["data"]["repo"]
        assert repo["is_private"] is True

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_is_private_true_for_internal_project(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        event["project"]["visibility_level"] = 10

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        repo = self.mock_seer.call_args[1]["payload"]["data"]["repo"]
        assert repo["is_private"] is True

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_is_private_false_for_public_project(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        event["project"]["visibility_level"] = 20

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        repo = self.mock_seer.call_args[1]["payload"]["data"]["repo"]
        assert repo["is_private"] is False

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_is_private_none_when_visibility_absent(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        del event["project"]["visibility_level"]

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        repo = self.mock_seer.call_args[1]["payload"]["data"]["repo"]
        assert repo["is_private"] is None

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_trigger_on_ready_for_review_for_open(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["config"]["trigger"] == "on_ready_for_review"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_trigger_on_new_commit_for_update(self) -> None:
        self._setup_code_review()
        event = _make_event("update", oldrev="0" * 40)

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["config"]["trigger"] == "on_new_commit"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_contains_trigger_user_from_event(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        payload = call_kwargs["payload"]
        assert payload["data"]["config"]["trigger_user"] == "root"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_open_with_gitlab_space_utc_timestamp_enqueues(self) -> None:
        # GitLab serializes merge_request object_attributes timestamps as the
        # Rails "Time#to_s" default -- e.g. "2026-01-16 05:56:22 UTC" (space
        # separator, textual "UTC" suffix) -- per the documented payload at
        # https://docs.gitlab.com/user/project/integrations/webhook_events/.
        # That form is NOT ISO 8601, so SeerCodeReviewConfig.trigger_at (a
        # Pydantic v1 datetime) rejects it with value_error.datetime and the
        # whole review is silently dropped in _schedule_task. The shared fixture
        # happens to use ISO 8601, so this case is exercised explicitly here.
        self._setup_code_review()
        event = _make_event(
            "open",
            created_at="2026-01-16 05:56:22 UTC",
            updated_at="2026-01-16 05:56:25 UTC",
        )

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        payload = self.mock_seer.call_args[1]["payload"]
        # updated_at wins over created_at and is normalized to ISO 8601 (UTC).
        assert payload["data"]["config"]["trigger_at"] == "2026-01-16T05:56:25+00:00"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_open_with_iso8601_timestamp_still_enqueues(self) -> None:
        # Some GitLab versions/editions emit ISO 8601 for MR events. dateutil
        # normalization must remain a strict superset and not regress that path.
        self._setup_code_review()
        event = _make_event(
            "open",
            created_at="2017-09-20T08:31:45.944Z",
            updated_at="2017-09-28T12:23:42.365Z",
        )

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        payload = self.mock_seer.call_args[1]["payload"]
        assert payload["data"]["config"]["trigger_at"] == "2017-09-28T12:23:42.365000+00:00"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_open_with_unparseable_timestamp_captures_and_falls_back(self) -> None:
        # An unparseable trigger_at is not fatal -- the review proceeds with a
        # "now" fallback -- but the unhandled format must be escalated to Sentry
        # so we learn about it instead of silently using the wrong timestamp.
        self._setup_code_review()
        event = _make_event("open", created_at="not a timestamp", updated_at="not a timestamp")

        with (
            patch(
                "sentry.seer.code_review.webhooks.merge_request.sentry_sdk.capture_exception"
            ) as mock_capture,
            self.tasks(),
        ):
            self._call_handler(event)

        mock_capture.assert_called_once()
        # Review still enqueues with a valid ISO 8601 fallback timestamp.
        self.mock_seer.assert_called_once()
        trigger_at = self.mock_seer.call_args[1]["payload"]["data"]["config"]["trigger_at"]
        assert trigger_at.endswith("+00:00")

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_duplicate_delivery_within_window_skipped(self) -> None:
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)
            self._call_handler(event)

        self.mock_seer.assert_called_once()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_duplicate_delivery_after_ttl_processes_again(self) -> None:
        self._setup_code_review()
        event = _make_event("open")
        commit_sha = event["object_attributes"]["last_commit"]["id"]
        iid = event["object_attributes"]["iid"]

        with self.tasks():
            self._call_handler(event)
        assert self.mock_seer.call_count == 1

        # Simulate TTL expiry so the same delivery can be processed again.
        seen_key = (
            f"{WEBHOOK_SEEN_KEY_PREFIX}{self.organization.id}:{self.repo.id}:"
            f"{iid}:open:{commit_sha}"
        )
        redis_clusters.get("default").delete(seen_key)

        with self.tasks():
            self._call_handler(event)
        assert self.mock_seer.call_count == 2

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_distinct_commits_are_not_deduped(self) -> None:
        # Two new-commit pushes have different last_commit ids, so they are distinct
        # operations and both must reach Seer despite sharing the same MR and action.
        self._setup_code_review()
        first = _make_event("update", oldrev="0" * 40)
        second = _make_event("update", oldrev="0" * 40)
        second["object_attributes"]["last_commit"] = {
            **second["object_attributes"]["last_commit"],
            "id": "f" * 40,
        }

        with self.tasks():
            self._call_handler(first)
            self._call_handler(second)

        assert self.mock_seer.call_count == 2


# ---------------------------------------------------------------------------
# Note event (@sentry review) tests
# ---------------------------------------------------------------------------


def _make_note_event(**overrides: object) -> dict[str, Any]:
    """Build a mutable copy of MERGE_REQUEST_NOTE_EVENT with optional overrides."""
    event = orjson.loads(MERGE_REQUEST_NOTE_EVENT)
    for key, value in overrides.items():
        event["object_attributes"][key] = value
    return event


class MergeRequestNoteEventTest(GitLabTestCase):
    """Tests for the @sentry review note handler.

    GitLab fires a ``Note Hook`` when a user posts a comment on an MR. When the
    comment contains ``@sentry review`` the handler should enqueue a Seer review
    request with ``trigger: on_command_phrase``.
    """

    @pytest.fixture(autouse=True)
    def mock_seer_request(self) -> Generator[None]:
        with patch("sentry.seer.code_review.webhooks.task.make_seer_request") as mock_seer:
            self.mock_seer = mock_seer
            yield

    @pytest.fixture(autouse=True)
    def mock_scm(self) -> Generator[None]:
        mock_scm_instance = MagicMock(spec=CreatePullRequestCommentReactionProtocol)
        with patch(
            "sentry.seer.code_review.webhooks.merge_request.make_scm",
            return_value=mock_scm_instance,
        ):
            self.mock_scm = mock_scm_instance
            yield

    def _setup_code_review(self) -> None:
        repo = self.create_gitlab_repo(name="Cool Group / Sentry")
        repo.config["path"] = "cool-group/sentry"
        repo.save()
        self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=[
                CodeReviewTrigger.ON_NEW_COMMIT.value,
                CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
            ],
        )
        OrganizationContributors.objects.get_or_create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="51",
            defaults={
                "alias": "root",
                "provider": self.integration.provider,
                "hostname": instance_hostname(self.integration),
            },
        )
        self.repo = repo

    def _call_handler(self, event: dict[str, Any]) -> None:
        handle_merge_request_note_event(
            event=event,
            organization=RpcOrganization(
                id=self.organization.id,
                slug=self.organization.slug,
                name=self.organization.name,
            ),
            repo=self.repo,
            integration=self.integration,
        )

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_sentry_review_comment_schedules_seer_task(self) -> None:
        """@sentry review note must enqueue a Seer review-request task."""
        self._setup_code_review()
        event = _make_note_event()

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()
        call_kwargs = self.mock_seer.call_args[1]
        assert call_kwargs["path"] == "/v1/code_review/review-request"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_trigger_is_on_command_phrase(self) -> None:
        """The Seer payload must carry trigger=on_command_phrase."""
        self._setup_code_review()
        event = _make_note_event()

        with self.tasks():
            self._call_handler(event)

        payload = self.mock_seer.call_args[1]["payload"]
        assert payload["data"]["config"]["trigger"] == "on_command_phrase"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_contains_trigger_comment_id_and_type(self) -> None:
        """trigger_comment_id must be the note id; trigger_comment_type must be pull_request_review_comment."""
        self._setup_code_review()
        event = _make_note_event()

        with self.tasks():
            self._call_handler(event)

        config = self.mock_seer.call_args[1]["payload"]["data"]["config"]
        assert config["trigger_comment_id"] == 1243
        assert config["trigger_comment_type"] == "pull_request_review_comment"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_payload_trigger_user_is_commenter(self) -> None:
        """trigger_user must be the note author, not the MR author."""
        self._setup_code_review()
        event = _make_note_event()

        with self.tasks():
            self._call_handler(event)

        config = self.mock_seer.call_args[1]["payload"]["data"]["config"]
        assert config["trigger_user"] == "root"

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_eyes_reaction_added_to_note(self) -> None:
        """:eyes: must be added to the note (not to the MR description)."""
        self._setup_code_review()
        event = _make_note_event()

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_comment_reaction.assert_called_once_with(
            str(event["merge_request"]["iid"]),
            str(event["object_attributes"]["id"]),
            "eyes",
        )

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_non_review_command_is_ignored(self) -> None:
        """Notes without @sentry review must be silently dropped."""
        self._setup_code_review()
        event = _make_note_event(note="just a regular comment")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_issue_note_is_ignored(self) -> None:
        """Notes on issues (not MRs) must be silently dropped."""
        self._setup_code_review()
        event = _make_note_event(noteable_type="Issue")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_non_create_action_is_ignored(self) -> None:
        """Edited notes must not re-trigger a review."""
        self._setup_code_review()
        event = _make_note_event(action="update")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_sentry_review_case_insensitive(self) -> None:
        """@Sentry Review (any case) must also trigger a review."""
        self._setup_code_review()
        event = _make_note_event(note="Hey @Sentry Review please check this")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_duplicate_note_skipped(self) -> None:
        """A redelivered note (same note_id) within the TTL window must be skipped."""
        self._setup_code_review()
        event = _make_note_event()

        with self.tasks():
            self._call_handler(event)
            self._call_handler(event)

        self.mock_seer.assert_called_once()

    def test_skips_when_feature_flag_disabled(self) -> None:
        """Handler must no-op when organizations:seer-gitlab-support is off."""
        self._setup_code_review()
        event = _make_note_event()

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_skips_when_integration_is_none(self) -> None:
        self._setup_code_review()
        event = _make_note_event()

        with self.tasks():
            handle_merge_request_note_event(
                event=event,
                organization=RpcOrganization(
                    id=self.organization.id,
                    slug=self.organization.slug,
                    name=self.organization.name,
                ),
                repo=self.repo,
                integration=None,
            )

        self.mock_seer.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_reaction_failure_does_not_block_seer_task(self) -> None:
        """A failing note reaction must not prevent the Seer task from being scheduled."""
        self._setup_code_review()
        event = _make_note_event()
        self.mock_scm.create_pull_request_comment_reaction.side_effect = Exception("scm down")

        with self.tasks():
            self._call_handler(event)

        self.mock_seer.assert_called_once()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_duplicate_note_after_ttl_processes_again(self) -> None:
        """After Redis TTL expires the same note may be processed again."""
        self._setup_code_review()
        event = _make_note_event()
        note_id = event["object_attributes"]["id"]

        with self.tasks():
            self._call_handler(event)
        assert self.mock_seer.call_count == 1

        seen_key = f"{WEBHOOK_NOTE_SEEN_KEY_PREFIX}{self.organization.id}:{self.repo.id}:{note_id}"
        redis_clusters.get("default").delete(seen_key)

        with self.tasks():
            self._call_handler(event)
        assert self.mock_seer.call_count == 2


def _make_scm_reaction(reaction_id: int, content: str, author_id: int) -> dict[str, Any]:
    """Build a minimal ReactionResult-shaped dict for test fixtures.

    The real SCM provider stringifies ids (``ResourceId = str``), so the fixture
    coerces them too; the handler compares author ids by equality.
    """
    return {
        "id": str(reaction_id),
        "content": content,
        "author": {"id": str(author_id), "username": "sentry-bot"},
    }


class MergeRequestReactionTest(_MergeRequestHandlerTestBase):
    """Tests for the reaction-emoji behaviour added to the GitLab merge-request handler.

    The handler should add :eyes: (reaction "eyes") to the MR for every non-close
    action that passes all filter checks, and remove stale :tada: (reaction "hooray")
    awards left from a previous run.  Mirrors the GitHub pull_request path. Reactions
    are called via the SCM library's provider-agnostic actions module.
    """

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_eyes_reaction_added_for_open_action(self) -> None:
        """:eyes: reaction must be added to the MR when action=open."""
        self._setup_code_review()
        event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)
        mr_iid = str(event["object_attributes"]["iid"])

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_called_once_with(mr_iid, "eyes")

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_stale_hooray_reaction_deleted_before_eyes_added(self) -> None:
        """A stale :tada: ("hooray") reaction by our bot must be deleted before :eyes: is added."""
        self._setup_code_review()
        event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)
        mr_iid = str(event["object_attributes"]["iid"])

        # Seed an existing "hooray" reaction by our bot (author id 42).
        self.mock_scm.get_pull_request_reactions.return_value = {
            "data": [_make_scm_reaction(7, "hooray", 42)],
            "type": "gitlab",
            "raw": {},
            "meta": {"page_info": {}},
        }

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.delete_pull_request_reaction.assert_called_once_with(mr_iid, "7")
        self.mock_scm.create_pull_request_reaction.assert_called_once_with(mr_iid, "eyes")

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_other_users_hooray_reaction_not_deleted(self) -> None:
        """Reactions from other users must not be touched."""
        self._setup_code_review()
        event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)

        # A "hooray" reaction from a different user (id 99).
        self.mock_scm.get_pull_request_reactions.return_value = {
            "data": [_make_scm_reaction(8, "hooray", 99)],
            "type": "gitlab",
            "raw": {},
            "meta": {"page_info": {}},
        }

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.delete_pull_request_reaction.assert_not_called()
        self.mock_scm.create_pull_request_reaction.assert_called_once()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_no_reaction_for_close_action(self) -> None:
        """Close actions must not trigger any reaction changes."""
        self._setup_code_review()
        event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)
        event["object_attributes"]["action"] = "close"

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_not_called()
        self.mock_scm.delete_pull_request_reaction.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_no_reaction_for_merge_action(self) -> None:
        """Merge actions must not trigger any reaction changes."""
        self._setup_code_review()
        event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)
        event["object_attributes"]["action"] = "merge"

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_not_called()
        self.mock_scm.delete_pull_request_reaction.assert_not_called()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_reaction_failure_does_not_block_seer_task(self) -> None:
        """A failing reaction API call must not prevent the Seer task from being scheduled."""
        self._setup_code_review()
        event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)

        self.mock_scm.create_pull_request_reaction.side_effect = Exception("scm api down")

        with self.tasks():
            self._call_handler(event)

        # Seer task must still be scheduled even though the reaction failed.
        self.mock_seer.assert_called_once()

    @with_feature(
        {
            "organizations:gen-ai-features",
            "organizations:code-review-beta",
            "organizations:seer-gitlab-support",
        }
    )
    def test_eyes_reaction_added_for_update_with_new_commit(self) -> None:
        """:eyes: must also be added for update+commit (ON_NEW_COMMIT trigger)."""
        self._setup_code_review()
        event = orjson.loads(MERGE_REQUEST_OPENED_EVENT)
        event["object_attributes"]["action"] = "update"
        event["object_attributes"]["oldrev"] = "0" * 40
        mr_iid = str(event["object_attributes"]["iid"])

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_called_once_with(mr_iid, "eyes")
        # The reaction is best-effort decoration; the review must still be scheduled.
        self.mock_seer.assert_called_once()

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_eyes_not_readded_when_already_present(self) -> None:
        """An :eyes: our user already placed must not be re-added (GitLab rejects duplicates)."""
        self._setup_code_review()
        event = _make_event("open")
        self.mock_scm.get_pull_request_reactions.return_value = {
            "data": [_make_scm_reaction(5, "eyes", 42)],
            "type": "gitlab",
            "raw": {},
            "meta": {"page_info": {}},
        }

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_not_called()
        self.mock_seer.assert_called_once()

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_delete_happens_before_add(self) -> None:
        """Stale reactions are removed before the fresh :eyes: is added."""
        self._setup_code_review()
        event = _make_event("open")
        self.mock_scm.get_pull_request_reactions.return_value = {
            "data": [_make_scm_reaction(7, "hooray", 42)],
            "type": "gitlab",
            "raw": {},
            "meta": {"page_info": {}},
        }

        with self.tasks():
            self._call_handler(event)

        called = [c[0] for c in self.mock_scm.method_calls]
        assert called.index("delete_pull_request_reaction") < called.index(
            "create_pull_request_reaction"
        )

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_delete_failure_does_not_block_add(self) -> None:
        """A failed delete must not prevent the :eyes: add or the Seer task."""
        self._setup_code_review()
        event = _make_event("open")
        mr_iid = str(event["object_attributes"]["iid"])
        self.mock_scm.get_pull_request_reactions.return_value = {
            "data": [_make_scm_reaction(7, "hooray", 42)],
            "type": "gitlab",
            "raw": {},
            "meta": {"page_info": {}},
        }
        self.mock_scm.delete_pull_request_reaction.side_effect = Exception("scm api down")

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_called_once_with(mr_iid, "eyes")
        self.mock_seer.assert_called_once()

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_fetch_failure_does_not_block_add_or_seer(self) -> None:
        """A failed reaction lookup must not prevent the :eyes: add or the Seer task."""
        self._setup_code_review()
        event = _make_event("open")
        mr_iid = str(event["object_attributes"]["iid"])
        self.mock_scm.get_pull_request_reactions.side_effect = Exception("scm api down")

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_called_once_with(mr_iid, "eyes")
        self.mock_seer.assert_called_once()

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_scm_init_failure_does_not_block_seer_task(self) -> None:
        """If the SCM client cannot be built, the Seer task must still be scheduled."""
        self._setup_code_review()
        event = _make_event("open")

        with patch(
            "sentry.seer.code_review.webhooks.merge_request.scm_factory.new",
            side_effect=Exception("scm init down"),
        ):
            with self.tasks():
                self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_not_called()
        self.mock_seer.assert_called_once()

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_no_reaction_for_draft_open(self) -> None:
        """A draft MR is filtered before scheduling, so no reaction is placed."""
        self._setup_code_review()
        event = _make_event("open", draft=True)

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_not_called()
        self.mock_scm.delete_pull_request_reaction.assert_not_called()
        self.mock_seer.assert_not_called()

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_no_reaction_when_trigger_disabled(self) -> None:
        """open maps to ON_READY_FOR_REVIEW; with only ON_NEW_COMMIT enabled, nothing reacts."""
        self._setup_code_review(triggers=[CodeReviewTrigger.ON_NEW_COMMIT])
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_not_called()
        self.mock_seer.assert_not_called()

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_no_reaction_for_update_without_oldrev(self) -> None:
        """An update with no new commit / un-draft is filtered before any reaction."""
        self._setup_code_review()
        event = _make_event("update")

        with self.tasks():
            self._call_handler(event)

        self.mock_scm.create_pull_request_reaction.assert_not_called()
        self.mock_seer.assert_not_called()

    @with_feature(_MergeRequestHandlerTestBase.CODE_REVIEW_FEATURES)
    def test_no_reaction_for_duplicate_delivery(self) -> None:
        """A duplicate delivery is deduped before the reaction code, so :eyes: is added once."""
        self._setup_code_review()
        event = _make_event("open")

        with self.tasks():
            self._call_handler(event)
            self._call_handler(event)

        assert self.mock_scm.create_pull_request_reaction.call_count == 1
        assert self.mock_seer.call_count == 1
