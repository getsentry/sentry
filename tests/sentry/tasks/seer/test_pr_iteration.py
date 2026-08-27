from datetime import timedelta
from typing import Any, Literal
from unittest.mock import MagicMock, patch

import pytest
from scm.errors import ResourceNotFound
from scm.types import ReviewComment

from sentry.models.pullrequest import PullRequest
from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.autofix_agent import (
    PrIterationNoPullRequestException,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.check_suites import CheckSuiteAutofixRun
from sentry.seer.autofix.pr_iteration.feedback import Feedback, serialize_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTask
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.pause import PAUSED_EXTRA, pause_pr_iteration
from sentry.seer.autofix.pr_iteration.queue import (
    QueuedAutofixFeedback,
    peek_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.seer.autofix.pr_iteration.run_markers import record_run_extras
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun
from sentry.tasks.seer.pr_iteration import (
    UnsupportedProviderError,
    _build_review_feedback,
    _delete_own_comment_eyes_reaction,
    _ineligible_pr_iteration_comment_body,
    _resolve_review_comment_threads,
    consume_queued_autofix_feedback,
    trigger_consume_pr_iteration_feedback,
    trigger_pr_iteration_from_comment,
)
from sentry.testutils.cases import TestCase

TASK_PATH = "sentry.tasks.seer.pr_iteration"
CHECK_SUITE_SOURCE_PATH = "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite"
PAUSE_PATH = "sentry.seer.autofix.pr_iteration.pause"


class _CommentScmStub:
    """Spec for the SCM mock so the ``runtime_checkable`` protocol ``isinstance``
    guards in the task pass (a bare ``MagicMock`` fails them)."""

    def get_pull_request(self, *args: Any, **kwargs: Any) -> Any: ...

    def create_pull_request_comment(self, *args: Any, **kwargs: Any) -> Any: ...

    def get_repository_user_permission(self, *args: Any, **kwargs: Any) -> Any: ...

    def create_pull_request_comment_reaction(self, *args: Any, **kwargs: Any) -> Any: ...


class TriggerPrIterationFromCommentTest(TestCase):
    mock_make_scm: MagicMock
    mock_actions: MagicMock

    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="123",
            name="owner/repo",
        )
        self.comment = {"id": 999, "body": "@sentry fix it", "user": {"login": "octocat"}}
        self.feedback = Feedback(source=GithubPrCommentFeedbackSource(comment=self.comment))

        for attr, target in (
            ("mock_make_scm", "make_scm"),
            ("mock_actions", "scm_actions"),
        ):
            patcher = patch(f"{TASK_PATH}.{target}")
            setattr(self, attr, patcher.start())
            self.addCleanup(patcher.stop)

        self.mock_make_scm.return_value = MagicMock(spec=_CommentScmStub)
        self.mock_actions.get_pull_request.return_value = {"data": {"internal_id": "555"}}

    def _agent_state(self, blocks: list[MemoryBlock] | None = None) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=blocks or [],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_url="https://example.com/pull/7"
                )
            },
            metadata={"group_id": self.group.id},
        )

    def _iteration_block(self, idx: int) -> MemoryBlock:
        return MemoryBlock(
            id=f"iter{idx}",
            message=Message(
                role="assistant",
                metadata={"step": "pr_iteration", "iteration_index": idx},
            ),
            timestamp="2024-01-01T00:00:00Z",
        )

    def _stored_pr(self, *, external_id: int | None = None) -> PullRequest:
        pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="7",
        )
        if external_id is not None:
            pr.update(external_id=external_id)
        return pr

    def _call(self) -> None:
        trigger_pr_iteration_from_comment(
            organization_id=self.organization.id,
            repo_id=self.repo.id,
            integration_id=42,
            pr_number=7,
            feedback=self.feedback.json(),
        )

    @patch(f"{TASK_PATH}._add_comment_reaction")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=True)
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_triggers_agent_when_authorized(
        self,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        agent_state = self._agent_state()
        mock_get_state.return_value = agent_state

        self._call()

        mock_has_access.assert_called_once_with(
            self.mock_make_scm.return_value,
            "octocat",
        )
        mock_enqueue.assert_called_once()
        _, kwargs = mock_enqueue.call_args
        assert kwargs["run_id"] == 67890
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["group_id"] == self.group.id
        assert kwargs["referrer"] == AutofixReferrer.GITHUB_PR_COMMENT
        assert kwargs["run_state"] is agent_state
        assert kwargs["feedback"].text == "fix it"
        source = kwargs["feedback"].source
        assert isinstance(source, GithubPrCommentFeedbackSource)
        # The comment was parsed into feedback once at mention time and threaded
        # through, so the source stores it rather than re-parsing the body.
        assert source.comment_feedback == "fix it"

        mock_trigger_consume.assert_called_once()
        _, consume_kwargs = mock_trigger_consume.call_args
        assert consume_kwargs["run_id"] == 67890
        assert consume_kwargs["organization_id"] == self.organization.id
        assert consume_kwargs["run_state"] is agent_state

        mock_reaction.assert_called_once_with(
            self.mock_make_scm.return_value,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
            reaction="eyes",
        )

    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_resolves_pr_id_from_row_without_calling_github(
        self,
        mock_get_state: MagicMock,
    ) -> None:
        # The issue_comment payload carries only the PR number; a stored
        # ``external_id`` is what keeps that from costing a round-trip.
        mock_get_state.return_value = None
        self._stored_pr(external_id=555)

        self._call()

        self.mock_actions.get_pull_request.assert_not_called()
        mock_get_state.assert_called_once_with(self.organization.id, "integrations:github", 555)

    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_writes_external_id_back_on_a_miss(
        self,
        mock_get_state: MagicMock,
    ) -> None:
        mock_get_state.return_value = None
        pr = self._stored_pr()

        self._call()

        self.mock_actions.get_pull_request.assert_called_once_with(
            self.mock_make_scm.return_value, "7"
        )
        pr.refresh_from_db()
        assert pr.external_id == 555

    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_returns_when_the_provider_id_is_not_an_integer(
        self,
        mock_get_state: MagicMock,
    ) -> None:
        self.mock_actions.get_pull_request.return_value = {"data": {"internal_id": "not-a-number"}}
        pr = self._stored_pr()

        self._call()

        mock_get_state.assert_not_called()
        pr.refresh_from_db()
        assert pr.external_id is None

    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_returns_when_get_pull_request_fails(
        self,
        mock_get_state: MagicMock,
    ) -> None:
        self.mock_actions.get_pull_request.side_effect = ResourceNotFound()

        self._call()

        mock_get_state.assert_not_called()
        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="7").exists()

    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_stops_on_a_repo_whose_provider_is_not_pinned(
        self,
        mock_get_state: MagicMock,
    ) -> None:
        # Everything downstream reads github.com off `PR_ITERATION_PROVIDER`
        # instead of the repo, so a GHE repo reaching this task would key its
        # per-instance repo id into a cache that only github.com ids are unique
        # in — and ask Seer for a run under the wrong provider. The entry point
        # rejects GHE before dispatch; this pins that the task does not depend on
        # it having done so.
        self.repo.provider = "integrations:github_enterprise"
        self.repo.save()

        self._call()

        self.mock_make_scm.assert_not_called()
        mock_get_state.assert_not_called()
        self.mock_actions.get_pull_request.assert_not_called()
        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="7").exists()

    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=False)
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_skips_when_no_write_access(
        self,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
    ) -> None:
        mock_get_state.return_value = self._agent_state()

        self._call()

        mock_has_access.assert_called_once_with(self.mock_make_scm.return_value, "octocat")
        mock_enqueue.assert_not_called()
        mock_trigger_consume.assert_not_called()

    @patch(f"{TASK_PATH}._add_comment_reaction")
    @patch(f"{TASK_PATH}.default_cache")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access")
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_skips_when_no_agent_state(
        self,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_cache: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        # Missing runs must no-op: webhooks fan out to every region, so the
        # region that doesn't own the Autofix session must not react/comment
        # as if the PR were ineligible.
        mock_get_state.return_value = None

        self._call()

        mock_has_access.assert_not_called()
        mock_enqueue.assert_not_called()
        mock_trigger_consume.assert_not_called()
        mock_reaction.assert_not_called()
        self.mock_actions.create_pull_request_comment.assert_not_called()
        mock_cache.get.assert_not_called()
        mock_cache.set.assert_not_called()

    @patch(f"{TASK_PATH}._add_comment_reaction")
    @patch(f"{TASK_PATH}.default_cache")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access")
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_comments_ineligible_when_run_has_no_repo_pr_states(
        self,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_cache: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        # Found a Seer run (e.g. coding-agent handoff) but no Autofix PRs —
        # this is the case where we still explain ineligibility.
        mock_get_state.return_value = SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={},
            metadata={"group_id": self.group.id},
        )
        mock_cache.get.return_value = None

        self._call()

        mock_has_access.assert_not_called()
        mock_enqueue.assert_not_called()
        mock_trigger_consume.assert_not_called()
        mock_reaction.assert_called_once_with(
            self.mock_make_scm.return_value,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
            reaction="confused",
        )
        self.mock_actions.create_pull_request_comment.assert_called_once_with(
            self.mock_make_scm.return_value,
            "7",
            _ineligible_pr_iteration_comment_body("octocat"),
        )
        mock_cache.set.assert_called_once()

    @patch(f"{TASK_PATH}._add_comment_reaction")
    @patch(f"{TASK_PATH}.default_cache")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access")
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_skips_ineligible_comment_when_already_posted(
        self,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_cache: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        mock_get_state.return_value = SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={},
            metadata={"group_id": self.group.id},
        )
        mock_cache.get.return_value = True

        self._call()

        mock_reaction.assert_called_once_with(
            self.mock_make_scm.return_value,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
            reaction="confused",
        )
        self.mock_actions.create_pull_request_comment.assert_not_called()
        mock_cache.set.assert_not_called()
        mock_enqueue.assert_not_called()
        mock_trigger_consume.assert_not_called()

    @patch(f"{TASK_PATH}._add_comment_reaction")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=True)
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_triggers_comment_reaction(
        self,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        mock_get_state.return_value = self._agent_state()

        self._call()

        mock_enqueue.assert_called_once()
        mock_reaction.assert_called_once_with(
            self.mock_make_scm.return_value,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
            reaction="eyes",
        )

    @patch(f"{TASK_PATH}._add_comment_reaction")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=True)
    @patch(f"{TASK_PATH}.trigger_consume_pr_iteration_feedback")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    def test_iterates_past_max_iterations(
        self,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        # The max-iterations cap only bounds automatic (bot/check-suite) loops; a
        # manual @sentry comment still drives an iteration past the cap.
        mock_get_state.return_value = self._agent_state(
            blocks=[self._iteration_block(1), self._iteration_block(2)]
        )

        with self.options({"autofix.pr-iteration.max-iterations": 2}):
            self._call()

        mock_enqueue.assert_called_once()
        mock_trigger_consume.assert_called_once()
        mock_reaction.assert_called_once()


class ConsumeQueuedAutofixFeedbackTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _state(
        self,
        *,
        status: Literal["processing", "completed", "error", "awaiting_user_input"] = "completed",
        metadata: dict[str, Any] | None = None,
        blocks: list[MemoryBlock] | None = None,
    ) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=blocks or [],
            status=status,
            updated_at="2024-01-01T00:00:00Z",
            metadata={"group_id": self.group.id} if metadata is None else metadata,
        )

    def _queued(
        self,
        feedback: Feedback,
        referrer: AutofixReferrer = AutofixReferrer.GITHUB_PR_COMMENT,
        actor_user_id: int | None = None,
    ) -> QueuedAutofixFeedback:
        return QueuedAutofixFeedback(
            organization_id=self.organization.id,
            group_id=self.group.id,
            feedback=feedback,
            referrer=referrer,
            actor_user_id=actor_user_id,
        )

    def _iteration_block(self, idx: int) -> MemoryBlock:
        return MemoryBlock(
            id=f"iter{idx}",
            message=Message(
                role="assistant",
                metadata={"step": "pr_iteration", "iteration_index": idx},
            ),
            timestamp="2024-01-01T00:00:00Z",
        )

    def _review_feedback(
        self,
        comment_id: int,
        *,
        line: int | None = 42,
        start_line: int | None = None,
    ) -> Feedback:
        return Feedback(
            source=GithubPrReviewCommentFeedbackSource(
                comment={
                    "id": comment_id,
                    "body": "fix it",
                    "path": "src/sentry/foo.py",
                    "line": line,
                    "start_line": start_line,
                },
            )
        )

    def _check_suite_feedback(self, *, updated_at: str | None = "2024-01-01T00:00:00Z") -> Feedback:
        check_suite: dict[str, Any] = {
            "id": 1,
            "head_sha": "abc",
            "check_runs_url": "https://github.com/owner/repo/check-runs",
            "app": {"name": "CI"},
        }
        if updated_at is not None:
            check_suite["updated_at"] = updated_at
        event = {
            "check_suite": check_suite,
            "repository": {
                "html_url": "https://github.com/owner/repo",
                "full_name": "owner/repo",
            },
        }
        source = CheckSuiteFeedbackSource(event=event)
        autofix_run = CheckSuiteAutofixRun(
            repository=MagicMock(organization_id=self.organization.id, id=2),
            run_state=self._state(),
            pr_id=99,
            group_id=self.group.id,
        )
        with patch(
            "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite.resolve_check_suite_autofix_run",
            return_value=autofix_run,
        ):
            assert source.autofix_run is autofix_run
        return Feedback(source=source)

    def _state_on_head(self, **kwargs: Any) -> SeerRunState:
        state = self._state(**kwargs)
        state.repo_pr_states = {"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")}
        return state

    def _call(self) -> None:
        consume_queued_autofix_feedback(run_id=67890, organization_id=self.organization.id)

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_triggers_with_group_from_metadata(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it")))
        ]

        self._call()

        mock_trigger.assert_called_once()
        _, kwargs = mock_trigger.call_args
        assert kwargs["group"].id == self.group.id
        assert [f.text for f in kwargs["feedback"]] == ["fix it"]

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_returns_when_group_id_missing(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state(metadata={})

        self._call()

        mock_pop.assert_not_called()
        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_returns_and_empties_queue_when_paused(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        self.create_seer_run(
            organization=self.organization, seer_run_state_id=67890, user_id=self.user.id
        )
        try_enqueue_autofix_feedback(
            run_id=67890,
            organization_id=self.organization.id,
            group_id=self.group.id,
            feedback=Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it")),
            referrer=AutofixReferrer.WEB,
            run_state=self._state(),
        )
        with record_run_extras(SeerRun.objects.get(seer_run_state_id=67890)) as extras:
            extras[PAUSED_EXTRA] = {"paused_at": "2024-01-01T00:00:00+00:00"}

        with patch(f"{PAUSE_PATH}.metrics") as mock_metrics:
            self._call()

        mock_fetch.assert_not_called()
        mock_pop.assert_not_called()
        mock_trigger.assert_not_called()
        assert peek_queued_autofix_feedback(67890) == []
        mock_metrics.incr.assert_any_call(
            "autofix.pr_iteration.paused.blocked", tags={"gate": "consume"}
        )

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_returns_when_processing(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state(status="processing")

        self._call()

        mock_pop.assert_not_called()
        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.fetch_run_status", side_effect=SeerApiError("nope", 500))
    def test_returns_when_run_state_not_found(
        self,
        _mock_fetch: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        self._call()

        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_filters_stale_feedback(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        stale = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 555, "body": "@sentry stale"})
        )
        block = MemoryBlock(
            id="b1",
            message=Message(role="assistant", metadata={"feedback": serialize_feedback([stale])}),
            timestamp="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = self._state(blocks=[block])
        fresh = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 777, "body": "@sentry fresh"})
        )
        mock_pop.return_value = [
            self._queued(
                stale,
                AutofixReferrer.GITHUB_PR_REVIEW,
                actor_user_id=self.create_user().id,
            ),
            self._queued(
                fresh,
                AutofixReferrer.GITHUB_PR_COMMENT,
                actor_user_id=self.user.id,
            ),
        ]

        self._call()

        mock_trigger.assert_called_once()
        _, kwargs = mock_trigger.call_args
        assert [f.text for f in kwargs["feedback"]] == ["fresh"]
        assert kwargs["referrer"] == AutofixReferrer.GITHUB_PR_COMMENT
        assert kwargs["actor_user_id"] == self.user.id

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_does_not_trigger_when_all_feedback_stale(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        stale = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 555, "body": "@sentry stale"})
        )
        block = MemoryBlock(
            id="b1",
            message=Message(role="assistant", metadata={"feedback": serialize_feedback([stale])}),
            timestamp="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = self._state(blocks=[block])
        mock_pop.return_value = [self._queued(stale)]

        self._call()

        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_skips_review_comment_already_processed(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        feedback = self._review_feedback(555)
        block = MemoryBlock(
            id="b1",
            message=Message(
                role="assistant", metadata={"feedback": serialize_feedback([feedback])}
            ),
            timestamp="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = self._state(blocks=[block])
        mock_pop.return_value = [self._queued(feedback)]

        self._call()

        mock_trigger.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_consumes_feedback_past_max_iterations(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        # consume no longer enforces the cap; a queued comment past the old limit
        # still triggers an iteration. Automatic loops are bounded upstream (the
        # review trigger and the check-suite hard cap), not here.
        mock_fetch.return_value = self._state(
            blocks=[self._iteration_block(1), self._iteration_block(2)]
        )
        mock_pop.return_value = [
            self._queued(
                Feedback(
                    source=GithubPrCommentFeedbackSource(comment={"id": 1, "body": "@sentry go"})
                )
            )
        ]

        with self.options({"autofix.pr-iteration.max-iterations": 2}):
            self._call()

        mock_trigger.assert_called_once()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_collapses_duplicate_review_comment_ids_in_batch(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(self._review_feedback(666)),
            self._queued(self._review_feedback(666)),
        ]

        self._call()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 1

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_keeps_same_suite_different_updated_at_in_batch(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        """Re-run in the same drain batch must not be dropped by suite-id coalesce."""
        mock_fetch.return_value = self._state_on_head()
        mock_pop.return_value = [
            self._queued(self._check_suite_feedback(updated_at="2024-01-01T00:00:00Z")),
            self._queued(self._check_suite_feedback(updated_at="2024-01-02T00:00:00Z")),
        ]

        self._call()

        mock_trigger.assert_called_once()
        feedback = mock_trigger.call_args.kwargs["feedback"]
        assert len(feedback) == 2
        assert [f.source.event.check_suite.updated_at for f in feedback] == [
            "2024-01-01T00:00:00Z",
            "2024-01-02T00:00:00Z",
        ]

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_collapses_duplicate_attempt_key_in_batch(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state_on_head()
        mock_pop.return_value = [
            self._queued(self._check_suite_feedback(updated_at="2024-01-01T00:00:00Z")),
            self._queued(self._check_suite_feedback(updated_at="2024-01-01T00:00:00Z")),
        ]

        self._call()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 1

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_collapses_legacy_missing_updated_at_by_suite_id(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state_on_head()
        mock_pop.return_value = [
            self._queued(self._check_suite_feedback(updated_at=None)),
            self._queued(self._check_suite_feedback(updated_at=None)),
        ]

        self._call()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 1

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_issue_and_review_comment_with_same_id_not_collapsed(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        issue_feedback = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 777, "body": "@sentry fix it"})
        )
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(issue_feedback),
            self._queued(self._review_feedback(777)),
        ]

        self._call()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 2

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_collapses_duplicate_review_body_ids_in_batch(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        body = lambda: Feedback(
            source=GithubPrReviewBodyFeedbackSource(review_id=500, body="summary")
        )
        mock_pop.return_value = [self._queued(body()), self._queued(body())]

        self._call()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 1

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_review_body_and_comment_not_collapsed(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        # A review body item and an inline comment item both flow through — they
        # dedupe on separate id namespaces.
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(
                Feedback(source=GithubPrReviewBodyFeedbackSource(review_id=1, body="summary"))
            ),
            self._queued(self._review_feedback(1)),
        ]

        self._call()

        mock_trigger.assert_called_once()
        assert len(mock_trigger.call_args.kwargs["feedback"]) == 2

    @patch(f"{TASK_PATH}.trigger_autofix_agent", side_effect=PrIterationNoPullRequestException())
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_swallows_pr_iteration_exceptions(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        _mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it")))
        ]

        self._call()

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_review_comment_range_anchor_in_user_context(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [self._queued(self._review_feedback(888, line=42, start_line=40))]

        self._call()

        mock_trigger.assert_called_once()
        assert (
            mock_trigger.call_args.kwargs["user_context"]
            == "Inline comment on src/sentry/foo.py:40-42:\nfix it"
        )

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_review_comment_single_line_anchor_in_user_context(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [self._queued(self._review_feedback(999, line=42))]

        self._call()

        mock_trigger.assert_called_once()
        assert (
            mock_trigger.call_args.kwargs["user_context"]
            == "Inline comment on src/sentry/foo.py:42:\nfix it"
        )

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_non_review_feedback_text_passed_through(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state()
        mock_pop.return_value = [
            self._queued(
                Feedback(
                    source=GithubPrCommentFeedbackSource(
                        comment={"id": 1001, "body": "@sentry top level"}
                    )
                )
            ),
            self._queued(
                Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="ui feedback"))
            ),
        ]

        self._call()

        mock_trigger.assert_called_once()
        assert mock_trigger.call_args.kwargs["user_context"] == "top level\n\nui feedback"

    def _commenter_feedback(self, comment_id: int, login: str, user_id: int) -> Feedback:
        return Feedback(
            source=GithubPrCommentFeedbackSource(
                comment={
                    "id": comment_id,
                    "body": "@sentry fix it",
                    "user": {"id": user_id, "login": login},
                }
            )
        )

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_commit_author_attributed_to_a_single_commenter(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        octocat = self._commenter_feedback(1001, "octocat", 583231)
        hubot = self._commenter_feedback(1002, "hubot", 2)
        mock_fetch.return_value = self._state()

        mock_pop.return_value = [self._queued(octocat)]
        self._call()
        assert mock_trigger.call_args.kwargs["commit_author"] == {
            "name": "octocat",
            "email": "583231+octocat@users.noreply.github.com",
        }

        # Two different commenters in one batch: no single author to attribute to.
        mock_pop.return_value = [self._queued(octocat), self._queued(hubot)]
        self._call()
        assert mock_trigger.call_args.kwargs["commit_author"] is None

    @patch(f"{TASK_PATH}.trigger_autofix_agent")
    @patch(f"{TASK_PATH}.pop_queued_autofix_feedback")
    @patch(f"{TASK_PATH}.fetch_run_status")
    def test_no_commit_author_for_check_suite_feedback(
        self,
        mock_fetch: MagicMock,
        mock_pop: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_fetch.return_value = self._state_on_head()
        mock_pop.return_value = [self._queued(self._check_suite_feedback())]

        self._call()

        assert mock_trigger.call_args.kwargs["commit_author"] is None


class TriggerConsumePrIterationFeedbackTest(TestCase):
    def _feedback(self) -> Feedback:
        return Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it"))

    def _state(self) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_skips_when_paused(self, mock_apply: MagicMock) -> None:
        self.create_seer_run(
            organization=self.organization, seer_run_state_id=67890, user_id=self.user.id
        )
        pause_pr_iteration(run_id=67890, organization_id=self.organization.id)

        with patch(f"{PAUSE_PATH}.metrics") as mock_metrics:
            trigger_consume_pr_iteration_feedback(
                run_id=67890,
                organization_id=self.organization.id,
                feedback=self._feedback(),
                run_state=self._state(),
                bypass=True,
            )

        mock_apply.assert_not_called()
        mock_metrics.incr.assert_any_call(
            "autofix.pr_iteration.paused.blocked", tags={"gate": "trigger_consume"}
        )

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_triggers_when_should_trigger_true(self, mock_apply: MagicMock) -> None:
        trigger_consume_pr_iteration_feedback(
            run_id=67890,
            organization_id=self.organization.id,
            feedback=self._feedback(),
            run_state=self._state(),
        )

        mock_apply.assert_called_once_with(
            kwargs={"run_id": 67890, "organization_id": self.organization.id},
            countdown=None,
        )

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_skips_when_no_consume_task(self, mock_apply: MagicMock) -> None:
        feedback = self._feedback()
        with patch.object(type(feedback.source), "should_trigger", return_value=None):
            trigger_consume_pr_iteration_feedback(
                run_id=67890,
                organization_id=self.organization.id,
                feedback=feedback,
                run_state=self._state(),
            )

        mock_apply.assert_not_called()

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_queues_later_task_with_countdown(self, mock_apply: MagicMock) -> None:
        feedback = self._feedback()
        with patch.object(
            type(feedback.source),
            "should_trigger",
            return_value=ConsumeTask.Later(timedelta(hours=1)),
        ):
            trigger_consume_pr_iteration_feedback(
                run_id=67890,
                organization_id=self.organization.id,
                feedback=feedback,
                run_state=self._state(),
            )

        mock_apply.assert_called_once_with(
            kwargs={"run_id": 67890, "organization_id": self.organization.id},
            countdown=3600,
        )

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_bypass_ignores_should_trigger(self, mock_apply: MagicMock) -> None:
        feedback = self._feedback()
        with patch.object(type(feedback.source), "should_trigger", return_value=None):
            trigger_consume_pr_iteration_feedback(
                run_id=67890,
                organization_id=self.organization.id,
                feedback=feedback,
                run_state=self._state(),
                bypass=True,
            )

        mock_apply.assert_called_once()

    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_passes_delay_as_countdown(self, mock_apply: MagicMock) -> None:
        trigger_consume_pr_iteration_feedback(
            run_id=67890,
            organization_id=self.organization.id,
            feedback=self._feedback(),
            run_state=self._state(),
            delay=30,
        )

        _, kwargs = mock_apply.call_args
        assert kwargs["countdown"] == 30


class _ReactionScmProtocols:
    """Method surface matching the reaction protocols so ``spec`` MagicMocks
    satisfy the ``@runtime_checkable`` ``isinstance`` guards. Covers both the
    top-level PR-comment and inline review-comment reaction namespaces."""

    def get_authenticated_actor(self) -> Any: ...

    def get_pull_request_comment_reactions(self, *args: Any, **kwargs: Any) -> Any: ...

    def delete_pull_request_comment_reaction(self, *args: Any, **kwargs: Any) -> Any: ...

    def get_review_comment_reactions(self, *args: Any, **kwargs: Any) -> Any: ...

    def delete_review_comment_reaction(self, *args: Any, **kwargs: Any) -> Any: ...


class DeleteOwnCommentEyesReactionTest(TestCase):
    ACTOR_ID = "actor-1"

    def _scm(self) -> MagicMock:
        return MagicMock(spec=_ReactionScmProtocols)

    def _reactions_result(self, reactions: list[dict[str, Any]]) -> dict[str, Any]:
        return {"data": reactions}

    @patch(f"{TASK_PATH}.scm_actions")
    def test_deletes_only_own_eyes(self, mock_scm_actions: MagicMock) -> None:
        scm = self._scm()
        mock_scm_actions.get_authenticated_actor.return_value = {"data": {"id": self.ACTOR_ID}}
        mock_scm_actions.get_pull_request_comment_reactions.return_value = self._reactions_result(
            [
                {"id": "r1", "content": "eyes", "author": {"id": self.ACTOR_ID}},
                {"id": "r2", "content": "eyes", "author": {"id": "someone-else"}},
                {"id": "r3", "content": "hooray", "author": {"id": self.ACTOR_ID}},
                {"id": "r4", "content": "eyes", "author": None},
            ]
        )

        _delete_own_comment_eyes_reaction(
            scm, source_type="github-pr-comment", pr_number=7, comment_id=111
        )

        mock_scm_actions.delete_pull_request_comment_reaction.assert_called_once_with(
            scm, "7", "111", "r1"
        )

    @patch(f"{TASK_PATH}.scm_actions")
    def test_deletes_only_own_eyes_on_review_comment(self, mock_scm_actions: MagicMock) -> None:
        # Inline review comments use the review-comment reaction namespace, not
        # the top-level PR-comment one.
        scm = self._scm()
        mock_scm_actions.get_authenticated_actor.return_value = {"data": {"id": self.ACTOR_ID}}
        mock_scm_actions.get_review_comment_reactions.return_value = self._reactions_result(
            [
                {"id": "r1", "content": "eyes", "author": {"id": self.ACTOR_ID}},
                {"id": "r2", "content": "eyes", "author": {"id": "someone-else"}},
            ]
        )

        _delete_own_comment_eyes_reaction(
            scm, source_type="github-pr-review-comment", pr_number=7, comment_id=222
        )

        mock_scm_actions.get_review_comment_reactions.assert_called_once_with(scm, "7", "222")
        mock_scm_actions.delete_review_comment_reaction.assert_called_once_with(
            scm, "7", "222", "r1"
        )
        mock_scm_actions.delete_pull_request_comment_reaction.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_noop_for_unsupported_provider(self, mock_scm_actions: MagicMock) -> None:
        # A mock missing one protocol method fails the isinstance guard.
        scm = MagicMock(
            spec=[
                "get_authenticated_actor",
                "get_pull_request_comment_reactions",
            ]
        )

        _delete_own_comment_eyes_reaction(
            scm, source_type="github-pr-comment", pr_number=7, comment_id=111
        )

        mock_scm_actions.delete_pull_request_comment_reaction.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_noop_for_unsupported_provider_review_comment(
        self, mock_scm_actions: MagicMock
    ) -> None:
        # Supports the top-level namespace but not the review-comment one.
        scm = MagicMock(
            spec=[
                "get_authenticated_actor",
                "get_pull_request_comment_reactions",
                "delete_pull_request_comment_reaction",
            ]
        )

        _delete_own_comment_eyes_reaction(
            scm, source_type="github-pr-review-comment", pr_number=7, comment_id=222
        )

        mock_scm_actions.delete_review_comment_reaction.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_noop_when_actor_unavailable(self, mock_scm_actions: MagicMock) -> None:
        # A mock missing get_authenticated_actor fails the isinstance guard.
        scm = MagicMock(
            spec=["get_pull_request_comment_reactions", "delete_pull_request_comment_reaction"]
        )

        _delete_own_comment_eyes_reaction(
            scm, source_type="github-pr-comment", pr_number=7, comment_id=111
        )

        mock_scm_actions.get_authenticated_actor.assert_not_called()
        mock_scm_actions.delete_pull_request_comment_reaction.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_swallows_exceptions(self, mock_scm_actions: MagicMock) -> None:
        scm = self._scm()
        mock_scm_actions.get_authenticated_actor.side_effect = RuntimeError("boom")

        _delete_own_comment_eyes_reaction(
            scm, source_type="github-pr-comment", pr_number=7, comment_id=111
        )

        mock_scm_actions.delete_pull_request_comment_reaction.assert_not_called()


class _ResolveThreadScmProtocols:
    """Method surface matching the resolve protocols so ``spec`` MagicMocks
    satisfy the ``@runtime_checkable`` ``isinstance`` guards."""

    def get_thread_id_from_review_comment_unique_id(self, *args: Any, **kwargs: Any) -> Any: ...

    def resolve_review_thread(self, *args: Any, **kwargs: Any) -> Any: ...

    def get_pull_request_review_threads(self, *args: Any, **kwargs: Any) -> Any: ...


class ResolveReviewCommentThreadsTest(TestCase):
    def _scm(self) -> MagicMock:
        return MagicMock(spec=_ResolveThreadScmProtocols)

    def _thread(
        self,
        thread_id: str,
        comment_unique_ids: list[str],
        *,
        is_resolved: bool = False,
    ) -> dict[str, Any]:
        return {
            "id": thread_id,
            "is_resolved": is_resolved,
            "comments": [{"unique_id": uid} for uid in comment_unique_ids],
        }

    def _page(
        self, threads: list[dict[str, Any]], next_cursor: str | None = None
    ) -> dict[str, Any]:
        return {"data": threads, "meta": {"next_cursor": next_cursor}}

    @patch(f"{TASK_PATH}.scm_actions")
    def test_resolves_matching_threads(self, mock_scm_actions: MagicMock) -> None:
        scm = self._scm()
        mock_scm_actions.get_pull_request_review_threads.return_value = self._page(
            [self._thread("PRRT_1", ["PRRC_a"]), self._thread("PRRT_2", ["PRRC_b"])]
        )

        result = _resolve_review_comment_threads(scm, pr_number=7, comment_unique_ids=["PRRC_a"])

        assert result.resolved == 1
        mock_scm_actions.resolve_review_thread.assert_called_once_with(scm, "7", "PRRT_1")

    @patch(f"{TASK_PATH}.scm_actions")
    def test_dedupes_shared_thread(self, mock_scm_actions: MagicMock) -> None:
        scm = self._scm()
        mock_scm_actions.get_pull_request_review_threads.return_value = self._page(
            [self._thread("PRRT_1", ["PRRC_a", "PRRC_b"])]
        )

        result = _resolve_review_comment_threads(
            scm, pr_number=7, comment_unique_ids=["PRRC_a", "PRRC_b"]
        )

        assert result.resolved == 1
        mock_scm_actions.resolve_review_thread.assert_called_once_with(scm, "7", "PRRT_1")

    @patch(f"{TASK_PATH}.scm_actions")
    def test_skips_already_resolved(self, mock_scm_actions: MagicMock) -> None:
        scm = self._scm()
        mock_scm_actions.get_pull_request_review_threads.return_value = self._page(
            [self._thread("PRRT_1", ["PRRC_a"], is_resolved=True)]
        )

        result = _resolve_review_comment_threads(scm, pr_number=7, comment_unique_ids=["PRRC_a"])

        assert result.resolved == 0
        assert result.already_resolved == 1
        mock_scm_actions.resolve_review_thread.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_unknown_unique_id_not_found(self, mock_scm_actions: MagicMock) -> None:
        scm = self._scm()
        mock_scm_actions.get_pull_request_review_threads.return_value = self._page(
            [self._thread("PRRT_1", ["PRRC_a"])]
        )

        result = _resolve_review_comment_threads(
            scm, pr_number=7, comment_unique_ids=["PRRC_missing"]
        )

        assert result.resolved == 0
        assert result.not_found == 1
        mock_scm_actions.resolve_review_thread.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_pages_until_exhausted(self, mock_scm_actions: MagicMock) -> None:
        scm = self._scm()
        pages = [
            self._page([self._thread("PRRT_1", ["PRRC_a"])], next_cursor="page-2"),
            self._page([self._thread("PRRT_2", ["PRRC_b"])]),
        ]

        # Assert the cursor is threaded across pages, not ignored: the first page
        # must start at ``after: null`` (empty cursor) and the second at page-1's
        # next_cursor.
        def get_threads(scm_arg: Any, pr_number_str: str, pagination: Any) -> dict[str, Any]:
            if mock_scm_actions.get_pull_request_review_threads.call_count == 1:
                assert pagination["cursor"] == ""
                assert pagination["per_page"] == 100
            else:
                assert pagination["cursor"] == "page-2"
            return pages[mock_scm_actions.get_pull_request_review_threads.call_count - 1]

        mock_scm_actions.get_pull_request_review_threads.side_effect = get_threads

        result = _resolve_review_comment_threads(scm, pr_number=7, comment_unique_ids=["PRRC_b"])

        assert result.resolved == 1
        assert mock_scm_actions.get_pull_request_review_threads.call_count == 2
        mock_scm_actions.resolve_review_thread.assert_called_once_with(scm, "7", "PRRT_2")

    @patch(f"{TASK_PATH}.scm_actions")
    def test_raises_for_unsupported_provider(self, mock_scm_actions: MagicMock) -> None:
        # A mock missing one protocol method fails the isinstance guard.
        scm = MagicMock(
            spec=["resolve_review_thread", "get_thread_id_from_review_comment_unique_id"]
        )

        with pytest.raises(UnsupportedProviderError):
            _resolve_review_comment_threads(scm, pr_number=7, comment_unique_ids=["PRRC_a"])

        mock_scm_actions.get_pull_request_review_threads.assert_not_called()
        mock_scm_actions.resolve_review_thread.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_propagates_exceptions(self, mock_scm_actions: MagicMock) -> None:
        scm = self._scm()
        mock_scm_actions.get_pull_request_review_threads.return_value = self._page(
            [self._thread("PRRT_1", ["PRRC_a"])]
        )
        mock_scm_actions.resolve_review_thread.side_effect = RuntimeError("boom")

        with pytest.raises(RuntimeError):
            _resolve_review_comment_threads(scm, pr_number=7, comment_unique_ids=["PRRC_a"])


class BuildReviewFeedbackTest(TestCase):
    def _review_comment(self, unique_id: str | None) -> ReviewComment:
        return {
            "id": "222",
            "unique_id": unique_id,
            "url": "https://example.com/c/222",
            "file_path": "test.py",
            "body": "inline feedback",
            "author": {"id": "1", "username": "octocat"},
            "created_at": None,
            "diff_hunk": None,
            "line": None,
            "start_line": None,
            "review_id": "55",
            "author_association": None,
            "commit_sha": None,
            "head": None,
            "thread_id": None,
        }

    def test_carries_unique_id_onto_source(self) -> None:
        feedback = _build_review_feedback(
            [self._review_comment("PRRC_a")],
            None,
            review_id=55,
            review_html_url=None,
            review_state=None,
            review_author=None,
            author_is_bot=False,
        )

        assert len(feedback) == 1
        source = feedback[0].source
        assert isinstance(source, GithubPrReviewCommentFeedbackSource)
        assert source.comment.unique_id == "PRRC_a"

    def test_missing_unique_id_is_none(self) -> None:
        feedback = _build_review_feedback(
            [self._review_comment(None)],
            None,
            review_id=55,
            review_html_url=None,
            review_state=None,
            review_author=None,
            author_is_bot=False,
        )

        source = feedback[0].source
        assert isinstance(source, GithubPrReviewCommentFeedbackSource)
        assert source.comment.unique_id is None
