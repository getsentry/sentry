from unittest.mock import ANY, MagicMock, patch

import orjson

from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.check_suites import (
    CheckRunsSweep,
    CheckSuiteAutofixRun,
    CheckSuiteFlagGate,
    GithubCheckSuiteEvent,
    InspectedCheckSuiteHead,
    ResolvedGreenCheckSuite,
    pr_iteration_enabled,
    resolve_check_suite_autofix_run,
    resolve_check_suite_flag_gate,
    resolve_check_suite_repositories,
    should_defer_pr_iteration,
)
from sentry.seer.autofix.pr_iteration.constants import (
    CAP_ASSIGN_FLAG,
    FAILING_CHECK_SUITE_FLAGS,
    GREEN_CHECK_SUITE_FLAGS,
    ITERATION_FLAG,
    MANUAL_FLAG,
    REVIEW_REQUEST_FLAG,
)
from sentry.seer.autofix.pr_iteration.feedback import Feedback, serialize_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import (
    ConsumeTask,
    Decision,
    TriggerDecision,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrReviewCommentFeedbackSource,
    GithubPullRequestReviewComment,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.listeners.check_suite import (
    pr_iteration_from_check_suite_listener,
)
from sentry.seer.autofix.pr_iteration.queue import QueuedAutofixFeedback
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

CHECK_PATH = "sentry.seer.autofix.pr_iteration.listeners.check_suite"
CHECK_SUITE_SOURCE_PATH = "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite"
CHECK_SUITES_PATH = "sentry.seer.autofix.pr_iteration.check_suites"

OWN_REPO_ID = 123


def own_repo_pr(pr_id: int) -> dict:
    """A ``pull_requests`` entry as GitHub sends it: based in the suite's own repo.

    GitHub always carries ``base.repo``, so a fixture without it is not a payload
    this path can receive.
    """
    return {"id": pr_id, "base": {"repo": {"id": OWN_REPO_ID}}}


# Lazy-imported inside the listener (must not load at AppConfig.ready).
TRIGGER_CONSUME_PATH = "sentry.tasks.seer.pr_iteration.trigger_consume_pr_iteration_feedback"
DEFER_PATH = f"{CHECK_PATH}.should_defer_pr_iteration"
INSPECT_PATH = f"{CHECK_SUITES_PATH}.inspect_check_suite_head"


def check_suite_event(
    raw: dict | None = None,
    *,
    action="completed",
    conclusion="failure",
    installation_id: int | None = None,
) -> CheckSuiteEvent:
    return CheckSuiteEvent(
        action=action,
        check_suite={
            "id": "1",
            "status": "completed",
            "conclusion": conclusion,
            "html_url": "",
            "pull_request_ids": [],
        },
        subscription_event={
            "event": orjson.dumps(raw or {}).decode(),
            "event_type_hint": "check_suite",
            "extra": {"installation_id": installation_id},
            "received_at": 0,
            "sentry_meta": None,
            "type": "github",
        },
    )


class PrIterationFromCheckSuiteListenerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        # The gate itself is covered by ``CheckSuiteFlagGateTest``; these tests are
        # about what each branch does with an event that is already through it.
        gate_patcher = patch(
            f"{CHECK_PATH}.resolve_check_suite_flag_gate",
            return_value=CheckSuiteFlagGate(
                organization_ids=[self.organization.id],
                organization_ids_by_flag={ITERATION_FLAG: [self.organization.id]},
            ),
        )
        self.mock_flag_gate = gate_patcher.start()
        self.addCleanup(gate_patcher.stop)

    def _event(
        self, raw: dict | None = None, *, action="completed", conclusion="failure"
    ) -> CheckSuiteEvent:
        return check_suite_event(raw, action=action, conclusion=conclusion)

    def _raw(self, *, pull_requests: list[dict] | None = None) -> dict:
        return {
            "check_suite": {
                "id": 1,
                "head_sha": "abc",
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
                "updated_at": "2024-01-01T00:00:00Z",
                "pull_requests": pull_requests or [],
            },
            "repository": {
                "html_url": "https://github.com/owner/repo",
                "id": OWN_REPO_ID,
            },
        }

    def _agent_state(self) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")},
            metadata={"group_id": self.group.id},
        )

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_skips_non_completed_action(self, mock_get_state: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(action="requested"))

        mock_get_state.assert_not_called()
        # Reading the action costs nothing; the gate costs an integration lookup.
        self.mock_flag_gate.assert_not_called()

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_skips_uninteresting_conclusion(self, mock_get_state: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(conclusion="cancelled"))

        mock_get_state.assert_not_called()
        self.mock_flag_gate.assert_not_called()

    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_drops_event_when_no_organization_is_flagged(
        self, mock_get_state: MagicMock, mock_resolve_green: MagicMock
    ) -> None:
        # An installation can resolve to organizations and still be dropped: what
        # matters is whether any of them holds a flag this conclusion feeds.
        self.mock_flag_gate.return_value = CheckSuiteFlagGate(
            organization_ids=[self.organization.id], organization_ids_by_flag={}
        )

        pr_iteration_from_check_suite_listener(self._event(self._raw()))
        pr_iteration_from_check_suite_listener(self._event(self._raw(), conclusion="success"))

        mock_get_state.assert_not_called()
        mock_resolve_green.assert_not_called()

        assert [call.args[1] for call in self.mock_flag_gate.call_args_list] == [
            FAILING_CHECK_SUITE_FLAGS,
            GREEN_CHECK_SUITE_FLAGS,
        ]

    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback", return_value=[])
    @patch(f"{CHECK_PATH}.green_review_side_effects_enabled", return_value=True)
    @patch(f"{CHECK_PATH}.get_run_marker", return_value=None)
    @patch(f"{CHECK_PATH}.request_review_from_context")
    @patch(f"{CHECK_PATH}.mark_ready_for_review")
    @patch(f"{CHECK_PATH}.confirm_green_check_suite")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_green_conclusion_bootstraps_then_side_effects(
        self,
        mock_get_state: MagicMock,
        mock_resolve: MagicMock,
        mock_confirm: MagicMock,
        mock_mark_ready: MagicMock,
        mock_request_review: MagicMock,
        _mock_marker: MagicMock,
        _mock_flag: MagicMock,
        _mock_peek: MagicMock,
    ) -> None:
        event = self._event(self._raw(), conclusion="success")
        resolved = MagicMock()
        ctx = MagicMock()
        mock_resolve.return_value = resolved
        mock_confirm.return_value = ctx
        call_order: list[str] = []
        mock_mark_ready.side_effect = lambda *_a, **_k: call_order.append("ready")
        mock_request_review.side_effect = lambda *_a, **_k: call_order.append("review")

        pr_iteration_from_check_suite_listener(event)

        mock_resolve.assert_called_once_with(event)
        mock_confirm.assert_called_once_with(resolved)
        mock_mark_ready.assert_called_once_with(ctx)
        mock_request_review.assert_called_once_with(ctx)
        assert call_order == ["ready", "review"]
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback", return_value=[])
    @patch(f"{CHECK_PATH}.green_review_side_effects_enabled", return_value=True)
    @patch(f"{CHECK_PATH}.get_run_marker")
    @patch(f"{CHECK_PATH}.request_review_from_context")
    @patch(f"{CHECK_PATH}.mark_ready_for_review")
    @patch(f"{CHECK_PATH}.confirm_green_check_suite")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_green_conclusion_runs_only_needed_side_effects(
        self,
        mock_get_state: MagicMock,
        mock_resolve: MagicMock,
        mock_confirm: MagicMock,
        mock_mark_ready: MagicMock,
        mock_request_review: MagicMock,
        mock_marker: MagicMock,
        _mock_flag: MagicMock,
        _mock_peek: MagicMock,
    ) -> None:
        from sentry.seer.autofix.pr_iteration.check_suites import (
            READY_FOR_REVIEW_EXTRA,
            REVIEW_REQUESTS_EXTRA,
        )

        resolved = MagicMock()
        ctx = MagicMock()
        mock_resolve.return_value = resolved
        mock_confirm.return_value = ctx
        # ready_for_review already marked; review_request still needed.
        mock_marker.side_effect = lambda _run, extra_key, _repo: (
            {"marked": True} if extra_key == READY_FOR_REVIEW_EXTRA else None
        )

        pr_iteration_from_check_suite_listener(self._event(self._raw(), conclusion="success"))

        mock_confirm.assert_called_once_with(resolved)
        mock_mark_ready.assert_not_called()
        mock_request_review.assert_called_once_with(ctx)
        assert mock_marker.call_args_list[0].args[1] == READY_FOR_REVIEW_EXTRA
        assert mock_marker.call_args_list[1].args[1] == REVIEW_REQUESTS_EXTRA
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback", return_value=[])
    @patch(f"{CHECK_PATH}.green_review_side_effects_enabled", return_value=True)
    @patch(f"{CHECK_PATH}.get_run_marker", return_value={"marked": True})
    @patch(f"{CHECK_PATH}.request_review_from_context")
    @patch(f"{CHECK_PATH}.mark_ready_for_review")
    @patch(f"{CHECK_PATH}.confirm_green_check_suite")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_green_conclusion_skips_scm_when_both_markers_set(
        self,
        mock_get_state: MagicMock,
        mock_resolve: MagicMock,
        mock_confirm: MagicMock,
        mock_mark_ready: MagicMock,
        mock_request_review: MagicMock,
        _mock_marker: MagicMock,
        _mock_flag: MagicMock,
        _mock_peek: MagicMock,
    ) -> None:
        mock_resolve.return_value = MagicMock()

        pr_iteration_from_check_suite_listener(self._event(self._raw(), conclusion="success"))

        mock_confirm.assert_not_called()
        mock_mark_ready.assert_not_called()
        mock_request_review.assert_not_called()
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback", return_value=[])
    @patch(f"{CHECK_PATH}.green_review_side_effects_enabled", return_value=False)
    @patch(f"{CHECK_PATH}.get_run_marker", return_value=None)
    @patch(f"{CHECK_PATH}.request_review_from_context")
    @patch(f"{CHECK_PATH}.mark_ready_for_review")
    @patch(f"{CHECK_PATH}.confirm_green_check_suite")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_green_conclusion_skips_side_effects_when_review_request_disabled(
        self,
        mock_resolve: MagicMock,
        mock_confirm: MagicMock,
        mock_mark_ready: MagicMock,
        mock_request_review: MagicMock,
        mock_marker: MagicMock,
        _mock_enabled: MagicMock,
        _mock_peek: MagicMock,
    ) -> None:
        """The resolve no longer implies the review-request flag; the caller checks it."""
        mock_resolve.return_value = MagicMock()

        pr_iteration_from_check_suite_listener(self._event(self._raw(), conclusion="success"))

        mock_marker.assert_not_called()
        mock_confirm.assert_not_called()
        mock_mark_ready.assert_not_called()
        mock_request_review.assert_not_called()

    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback", return_value=[])
    @patch(f"{CHECK_PATH}.green_review_side_effects_enabled", return_value=True)
    @patch(f"{CHECK_PATH}.get_run_marker", return_value=None)
    @patch(f"{CHECK_PATH}.request_review_from_context")
    @patch(f"{CHECK_PATH}.mark_ready_for_review")
    @patch(f"{CHECK_PATH}.confirm_green_check_suite", return_value=None)
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_green_conclusion_skips_side_effects_when_confirm_empty(
        self,
        mock_get_state: MagicMock,
        mock_resolve: MagicMock,
        _mock_confirm: MagicMock,
        mock_mark_ready: MagicMock,
        mock_request_review: MagicMock,
        _mock_marker: MagicMock,
        _mock_flag: MagicMock,
        _mock_peek: MagicMock,
    ) -> None:
        mock_resolve.return_value = MagicMock()
        pr_iteration_from_check_suite_listener(self._event(self._raw(), conclusion="success"))

        mock_mark_ready.assert_not_called()
        mock_request_review.assert_not_called()
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories", return_value=[])
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_no_repository(self, mock_get_state: MagicMock, _mock_resolve: MagicMock) -> None:
        pr_iteration_from_check_suite_listener(self._event(self._raw()))
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.sentry_sdk.capture_exception")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_invalid_payload_captures_and_returns(
        self, mock_get_state: MagicMock, mock_capture: MagicMock
    ) -> None:
        # Missing required check_suite fields (head_sha, check_runs_url, app).
        raw = {"check_suite": {"id": 1}, "repository": {"html_url": "https://github.com/o/r"}}
        pr_iteration_from_check_suite_listener(self._event(raw))
        mock_capture.assert_called_once()
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.sentry_sdk.capture_exception")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    def test_invalid_json_captures_and_returns(
        self, mock_get_state: MagicMock, mock_capture: MagicMock
    ) -> None:
        event = self._event()
        event.subscription_event["event"] = "not-json"
        pr_iteration_from_check_suite_listener(event)
        mock_capture.assert_called_once()
        mock_get_state.assert_not_called()

    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id", return_value=None)
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_skips_pr_without_run(
        self,
        mock_resolve: MagicMock,
        _mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id)]
        raw = self._raw(pull_requests=[own_repo_pr(555)])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_not_called()

    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_skips_run_missing_group_id(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id)]
        state = self._agent_state()
        state.metadata = {}
        mock_get_state.return_value = state
        raw = self._raw(pull_requests=[own_repo_pr(555)])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_not_called()

    @patch(f"{CHECK_PATH}.assign_user_for_exhausted_cap")
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=False)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_does_not_trigger_when_not_enqueued(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        _mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_assign: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state()
        raw = self._raw(pull_requests=[own_repo_pr(555)])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_trigger_consume.assert_not_called()
        # Rejected feedback routes to the cap-exhausted handler, which decides
        # itself whether this is the hard-cap case that needs a human.
        mock_assign.assert_called_once()
        event_arg, resolved_arg = mock_assign.call_args[0]
        assert event_arg.check_suite.head_sha == "abc"
        assert resolved_arg.run_state.run_id == 67890

    @patch(f"{CHECK_PATH}.assign_user_for_exhausted_cap")
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_enqueues_and_triggers_for_matched_run(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_assign: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state()
        raw = self._raw(pull_requests=[own_repo_pr(555)])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_enqueue.assert_called_once()
        _, kwargs = mock_enqueue.call_args
        assert kwargs["run_id"] == 67890
        assert kwargs["referrer"] == AutofixReferrer.GITHUB_CHECK_SUITE
        assert isinstance(kwargs["feedback"], Feedback)
        assert isinstance(kwargs["feedback"].source, CheckSuiteFeedbackSource)
        assert kwargs["feedback"].source.updated_at == "2024-01-01T00:00:00Z"
        assert kwargs["feedback"].source.event.check_suite.updated_at == "2024-01-01T00:00:00Z"
        autofix = kwargs["feedback"].source.autofix_run
        assert autofix is not None
        assert autofix.repository.organization_id == self.organization.id
        assert autofix.repository.id == 2
        assert autofix.run_state is not None
        mock_trigger_consume.assert_called_once()
        mock_assign.assert_not_called()

    @patch(f"{CHECK_SUITES_PATH}.sentry_sdk.capture_exception")
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_seer_error_on_one_pr_continues_to_remaining(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
        mock_capture: MagicMock,
    ) -> None:
        from sentry.seer.models import SeerApiError

        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        error = SeerApiError("transient", 500)
        mock_get_state.side_effect = [error, self._agent_state()]
        raw = self._raw(pull_requests=[own_repo_pr(111), own_repo_pr(222)])

        pr_iteration_from_check_suite_listener(self._event(raw))

        assert mock_get_state.call_count == 2
        mock_capture.assert_called_once_with(error)
        mock_enqueue.assert_called_once()
        mock_trigger_consume.assert_called_once()

    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_tries_each_org_until_agent_state_found(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_trigger_consume: MagicMock,
    ) -> None:
        wrong_org_repo = MagicMock(organization_id=111, id=1)
        right_org_repo = MagicMock(organization_id=self.organization.id, id=2)
        mock_resolve.return_value = [wrong_org_repo, right_org_repo]
        mock_get_state.side_effect = [None, self._agent_state()]
        raw = self._raw(pull_requests=[own_repo_pr(555)])

        pr_iteration_from_check_suite_listener(self._event(raw))

        assert mock_get_state.call_count == 2
        mock_get_state.assert_any_call(111, "integrations:github", 555)
        mock_get_state.assert_any_call(self.organization.id, "integrations:github", 555)
        _, kwargs = mock_enqueue.call_args
        assert kwargs["organization_id"] == self.organization.id
        mock_trigger_consume.assert_called_once()

    @patch(f"{CHECK_PATH}.logger")
    @patch(f"{CHECK_PATH}.sentry_sdk.capture_exception")
    def test_an_unparseable_payload_logs_what_the_stream_attached(
        self, mock_capture: MagicMock, mock_logger: MagicMock
    ) -> None:
        # Nothing parsed, so the only identifiers available are the ones the SCM
        # stream put on the envelope before anyone read the body.
        raw = {"check_suite": {"id": 1}, "repository": {"html_url": "https://github.com/o/r"}}
        event = check_suite_event(raw, installation_id=987)

        pr_iteration_from_check_suite_listener(event)

        mock_capture.assert_called_once()
        assert (
            mock_logger.error.call_args.args[0]
            == "autofix.pr_iteration.check_suite.unparseable_payload"
        )
        assert mock_logger.error.call_args.kwargs["extra"]["installation_id"] == 987
        assert mock_logger.error.call_args.kwargs["exc_info"] is True

    @patch(f"{CHECK_PATH}.metrics")
    @patch(f"{CHECK_PATH}.logger")
    @patch(f"{CHECK_PATH}.sentry_sdk.capture_exception")
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", side_effect=RuntimeError("redis is down"))
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_an_unexpected_failure_is_reported_against_the_run_it_broke(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        _mock_enqueue: MagicMock,
        mock_capture: MagicMock,
        mock_logger: MagicMock,
        mock_metrics: MagicMock,
    ) -> None:
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state()
        raw = self._raw(pull_requests=[own_repo_pr(555)])

        pr_iteration_from_check_suite_listener(self._event(raw))

        assert mock_logger.error.call_args.args[0] == "autofix.pr_iteration.check_suite.failed"
        extra = mock_logger.error.call_args.kwargs["extra"]
        # The point of catching it here: the failure names the run, which is what
        # `exec_listener` further up cannot do.
        assert extra["run_id"] == 67890
        assert extra["sentry_group_id"] == self.group.id
        assert extra["error_type"] == "RuntimeError"
        assert extra["check_suite_id"] == 1
        mock_capture.assert_called_once()
        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.check_suite.failed",
            tags={"error_type": "RuntimeError"},
        )

    @patch(f"{CHECK_PATH}.sentry_sdk.capture_exception")
    @patch(TRIGGER_CONSUME_PATH, side_effect=RuntimeError("celery is down"))
    @patch(f"{CHECK_PATH}.try_enqueue_autofix_feedback", return_value=True)
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_an_unexpected_failure_is_not_re_raised(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        _mock_enqueue: MagicMock,
        _mock_trigger: MagicMock,
        mock_capture: MagicMock,
    ) -> None:
        # Re-raising would hand `exec_listener` a second report of the same
        # failure; one, tied to the run, is what we want.
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state()
        raw = self._raw(pull_requests=[own_repo_pr(555)])

        pr_iteration_from_check_suite_listener(self._event(raw))

        mock_capture.assert_called_once()


class GreenCheckSuiteDeferredIterationTest(TestCase):
    """Green suite retriggers consume only if parked check-suite feedback matches this head."""

    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        gate_patcher = patch(
            f"{CHECK_PATH}.resolve_check_suite_flag_gate",
            return_value=CheckSuiteFlagGate(
                organization_ids=[self.organization.id],
                organization_ids_by_flag={ITERATION_FLAG: [self.organization.id]},
            ),
        )
        gate_patcher.start()
        self.addCleanup(gate_patcher.stop)

    def _event(self) -> CheckSuiteEvent:
        return CheckSuiteEvent(
            action="completed",
            check_suite={
                "id": "1",
                "status": "completed",
                "conclusion": "success",
                "html_url": "",
                "pull_request_ids": [],
            },
            subscription_event={
                "event": orjson.dumps(
                    {
                        "check_suite": {
                            "id": 1,
                            "head_sha": "abc",
                            "check_runs_url": "https://github.com/owner/repo/check-runs",
                            "app": {"name": "CI"},
                            "updated_at": "2024-01-01T00:00:00Z",
                            "pull_requests": [],
                        },
                        "repository": {"html_url": "https://github.com/owner/repo"},
                    }
                ).decode(),
                "event_type_hint": "check_suite",
                "extra": {},
                "received_at": 0,
                "sentry_meta": None,
                "type": "github",
            },
        )

    def _run_state(self) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")},
            metadata={"group_id": self.group.id},
        )

    def _resolved(self) -> MagicMock:
        resolved = MagicMock()
        resolved.organization = self.organization
        resolved.event.check_suite.head_sha = "abc"
        resolved.autofix_run.run_state = self._run_state()
        resolved.autofix_run.group_id = self.group.id
        resolved.log_extra = {"run_id": 67890}
        return resolved

    def _parked_check_suite(self, *, head_sha: str = "abc") -> QueuedAutofixFeedback:
        source = CheckSuiteFeedbackSource(
            event={
                "check_suite": {
                    "id": 1,
                    "head_sha": head_sha,
                    "check_runs_url": "https://github.com/owner/repo/check-runs",
                    "app": {"name": "CI"},
                },
                "repository": {"html_url": "https://github.com/owner/repo"},
            }
        )
        return QueuedAutofixFeedback(
            organization_id=self.organization.id,
            group_id=self.group.id,
            feedback=Feedback(source=source),
            referrer=AutofixReferrer.GITHUB_CHECK_SUITE,
        )

    @patch(DEFER_PATH, return_value=False)
    @patch(f"{CHECK_PATH}.request_review_from_context")
    @patch(f"{CHECK_PATH}.mark_ready_for_review")
    @patch(f"{CHECK_PATH}.confirm_green_check_suite")
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_parked_check_suite_on_this_head_triggers_consume(
        self,
        mock_resolve: MagicMock,
        mock_peek: MagicMock,
        mock_trigger: MagicMock,
        mock_confirm: MagicMock,
        mock_mark_ready: MagicMock,
        mock_request_review: MagicMock,
        mock_defer: MagicMock,
    ) -> None:
        resolved = self._resolved()
        parked = self._parked_check_suite()
        mock_resolve.return_value = resolved
        mock_peek.return_value = [parked]

        pr_iteration_from_check_suite_listener(self._event())

        mock_trigger.assert_called_once_with(
            log_ctx=ANY,
            run_id=67890,
            organization_id=self.organization.id,
            feedback=parked.feedback,
            run_state=resolved.autofix_run.run_state,
            bypass=True,
            triggered_by="green_check_suite",
        )
        mock_defer.assert_called_once_with(resolved)
        mock_confirm.assert_not_called()
        mock_mark_ready.assert_not_called()
        mock_request_review.assert_not_called()

    @patch(f"{CHECK_PATH}.logger")
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback", return_value=[])
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_empty_queue_does_not_trigger_consume(
        self,
        mock_resolve: MagicMock,
        _mock_peek: MagicMock,
        mock_trigger: MagicMock,
        mock_logger: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()

        pr_iteration_from_check_suite_listener(self._event())

        mock_trigger.assert_not_called()
        mock_logger.info.assert_any_call(
            "autofix.pr_iteration.feedback.trigger",
            extra={
                "run_id": 67890,
                "sentry_organization_id": self.organization.id,
                "sentry_group_id": self.group.id,
                "scm_infos": [{"scm_repo_full_name": "owner/repo"}],
                "triggered_by": "green_check_suite",
                "outcome": "not_triggered",
                "reason": "no_parked_feedback",
                "countdown": None,
                "trigger_id": None,
                "bypass": True,
            },
        )

    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_other_feedback_does_not_trigger_consume(
        self,
        mock_resolve: MagicMock,
        mock_peek: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_peek.return_value = [MagicMock()]

        pr_iteration_from_check_suite_listener(self._event())

        mock_trigger.assert_not_called()

    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_check_suite_on_other_head_does_not_trigger_consume(
        self,
        mock_resolve: MagicMock,
        mock_peek: MagicMock,
        mock_trigger: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_peek.return_value = [self._parked_check_suite(head_sha="old")]

        pr_iteration_from_check_suite_listener(self._event())

        mock_trigger.assert_not_called()

    @patch(DEFER_PATH, return_value=True)
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_unready_sweep_leaves_the_existing_deferral_alone(
        self,
        mock_resolve: MagicMock,
        mock_peek: MagicMock,
        mock_trigger: MagicMock,
        mock_defer: MagicMock,
    ) -> None:
        """Checks still running, or a sweep that could not run, keeps the 1h defer.

        Re-scheduling here would queue one duplicate consume per CI app on the head.
        """
        mock_resolve.return_value = self._resolved()
        mock_peek.return_value = [self._parked_check_suite()]

        pr_iteration_from_check_suite_listener(self._event())

        mock_defer.assert_called_once()
        mock_trigger.assert_not_called()

    @patch(DEFER_PATH, return_value=False)
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_rate_limit_sensitive_org_skips_the_sweep_entirely(
        self,
        mock_resolve: MagicMock,
        mock_peek: MagicMock,
        mock_trigger: MagicMock,
        mock_defer: MagicMock,
    ) -> None:
        """The opt-out lands before the peek: the sweep is the only reason to look."""
        mock_resolve.return_value = self._resolved()
        mock_peek.return_value = [self._parked_check_suite()]

        with override_options({"github-app.rate-limit-sensitive-orgs": [self.organization.slug]}):
            pr_iteration_from_check_suite_listener(self._event())

        mock_peek.assert_not_called()
        mock_defer.assert_not_called()
        mock_trigger.assert_not_called()

    @patch(INSPECT_PATH, return_value=None)
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_inconclusive_sweep_does_not_override_the_deferral(
        self,
        mock_resolve: MagicMock,
        mock_peek: MagicMock,
        mock_trigger: MagicMock,
        mock_inspect: MagicMock,
    ) -> None:
        """End to end through the real ``should_defer_pr_iteration``.

        An inspection that could not conclude says nothing about CI, so the
        parked 1h task stays the only scheduler.
        """
        mock_resolve.return_value = self._resolved()
        mock_peek.return_value = [self._parked_check_suite()]

        pr_iteration_from_check_suite_listener(self._event())

        mock_inspect.assert_called_once()
        mock_trigger.assert_not_called()

    @patch(DEFER_PATH, return_value=False)
    @patch(f"{CHECK_PATH}.get_run_marker", return_value={"marked": True})
    @patch(f"{CHECK_PATH}.confirm_green_check_suite")
    @patch(TRIGGER_CONSUME_PATH)
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_triggers_consume_even_when_both_markers_set(
        self,
        mock_resolve: MagicMock,
        mock_peek: MagicMock,
        mock_trigger: MagicMock,
        mock_confirm: MagicMock,
        _mock_marker: MagicMock,
        _mock_defer: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_peek.return_value = [self._parked_check_suite()]

        with self.feature(REVIEW_REQUEST_FLAG):
            pr_iteration_from_check_suite_listener(self._event())

        mock_trigger.assert_called_once()
        mock_confirm.assert_not_called()

    @patch(DEFER_PATH, return_value=False)
    @patch(f"{CHECK_PATH}.get_run_marker", return_value=None)
    @patch(f"{CHECK_PATH}.request_review_from_context")
    @patch(f"{CHECK_PATH}.mark_ready_for_review")
    @patch(f"{CHECK_PATH}.confirm_green_check_suite")
    @patch(TRIGGER_CONSUME_PATH, side_effect=ValueError("broker down"))
    @patch(f"{CHECK_PATH}.peek_queued_autofix_feedback")
    @patch(f"{CHECK_PATH}.resolve_green_check_suite")
    def test_failing_consume_schedule_still_runs_review_side_effects(
        self,
        mock_resolve: MagicMock,
        mock_peek: MagicMock,
        _mock_trigger: MagicMock,
        mock_confirm: MagicMock,
        mock_mark_ready: MagicMock,
        mock_request_review: MagicMock,
        _mock_marker: MagicMock,
        _mock_defer: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_peek.return_value = [self._parked_check_suite()]
        ctx = MagicMock()
        mock_confirm.return_value = ctx

        with self.feature(REVIEW_REQUEST_FLAG):
            pr_iteration_from_check_suite_listener(self._event())

        mock_mark_ready.assert_called_once_with(ctx)
        mock_request_review.assert_called_once_with(ctx)


class ShouldDeferPrIterationTest(TestCase):
    """Parked feedback keeps its deferral unless the sweep proves the head is finished."""

    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name="owner/repo"
        )
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=67890, user_id=self.user.id
        )

    def _resolved(self, *, blocks: list | None = None) -> ResolvedGreenCheckSuite:
        run_state = SeerRunState(
            run_id=67890,
            blocks=blocks or [],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")},
            metadata={"group_id": 1},
        )
        event = GithubCheckSuiteEvent.parse_obj(
            {
                "check_suite": {
                    "id": 1,
                    "head_sha": "abc",
                    "check_runs_url": "https://github.com/owner/repo/check-runs",
                    "app": {"name": "CI"},
                },
                "repository": {
                    "html_url": "https://github.com/owner/repo",
                    "full_name": "owner/repo",
                },
            }
        )
        return ResolvedGreenCheckSuite(
            event=event,
            organization=self.organization,
            autofix_run=CheckSuiteAutofixRun(
                repository=self.repo, run_state=run_state, pr_id=1, group_id=1
            ),
            seer_run=self.seer_run,
            repo_name="owner/repo",
            pr_number=42,
            log_extra={"run_id": 67890},
        )

    def _inspected(self, sweep: CheckRunsSweep) -> InspectedCheckSuiteHead:
        return InspectedCheckSuiteHead(
            scm=MagicMock(), pull_request=MagicMock(), head_sha="abc", sweep=sweep
        )

    @patch(INSPECT_PATH)
    def test_false_when_every_check_run_completed(self, mock_inspect: MagicMock) -> None:
        """Failed runs are expected — the parked feedback is a failed suite."""
        mock_inspect.return_value = self._inspected(CheckRunsSweep(total=3, incomplete=0, failed=1))

        assert should_defer_pr_iteration(self._resolved()) is False

    @patch(INSPECT_PATH)
    def test_true_when_a_check_run_is_incomplete(self, mock_inspect: MagicMock) -> None:
        mock_inspect.return_value = self._inspected(CheckRunsSweep(total=3, incomplete=1, failed=1))

        assert should_defer_pr_iteration(self._resolved()) is True

    @patch(INSPECT_PATH, return_value=None)
    def test_true_when_inspection_is_inconclusive(self, _mock_inspect: MagicMock) -> None:
        """``inspect_check_suite_head`` folds SCM init, provider, PR-fetch, stale-head
        and listing failures into ``None``. None of them mean CI finished."""
        assert should_defer_pr_iteration(self._resolved()) is True

    @patch(f"{CHECK_SUITES_PATH}.scm_actions.get_pull_request")
    @patch("sentry.scm.factory.new", side_effect=Exception("boom"))
    def test_true_when_scm_init_fails(self, _mock_new: MagicMock, mock_get_pr: MagicMock) -> None:
        assert should_defer_pr_iteration(self._resolved()) is True
        mock_get_pr.assert_not_called()

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", side_effect=Exception("boom"))
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch(f"{CHECK_SUITES_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CHECK_SUITES_PATH}.scm_actions.get_pull_request")
    @patch("sentry.scm.factory.new")
    def test_true_when_listing_check_runs_fails(
        self,
        mock_new: MagicMock,
        mock_get_pr: MagicMock,
        mock_pages: MagicMock,
    ) -> None:
        mock_new.return_value = MagicMock()
        mock_get_pr.return_value = {"data": {"head": {"sha": "abc"}}}

        assert should_defer_pr_iteration(self._resolved()) is True
        mock_pages.assert_called_once()

    @patch(INSPECT_PATH)
    def test_true_when_hard_cap_reached(self, mock_inspect: MagicMock) -> None:
        """A capped run must not iterate at all, so no sweep is worth paying for."""
        cap = 3
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(cap)]

        with self.options({"autofix.pr-iteration.max-iterations": cap}):
            assert should_defer_pr_iteration(self._resolved(blocks=blocks)) is True

        mock_inspect.assert_not_called()


class PrIterationEnabledTest(TestCase):
    """The coarse gate on the green resolve: any PR-iteration behaviour admits."""

    def test_disabled_without_any_flag(self) -> None:
        assert not pr_iteration_enabled(self.organization)

    def test_enabled_by_review_request_flag(self) -> None:
        with self.feature(REVIEW_REQUEST_FLAG):
            assert pr_iteration_enabled(self.organization)

    def test_enabled_by_automated_iteration_flag(self) -> None:
        with self.feature("organizations:autofix-pr-iteration"):
            assert pr_iteration_enabled(self.organization)

    def test_enabled_by_manual_iteration_flag(self) -> None:
        with self.feature("organizations:autofix-pr-iteration-manual"):
            assert pr_iteration_enabled(self.organization)


class ResolveCheckSuiteAutofixRunTest(TestCase):
    def _event(
        self, *, pull_requests: list[dict], repository_id: int | None = None
    ) -> GithubCheckSuiteEvent:
        return GithubCheckSuiteEvent.parse_obj(
            {
                "check_suite": {
                    "id": 1,
                    "head_sha": "abc",
                    "check_runs_url": "https://github.com/owner/repo/check-runs",
                    "app": {"name": "CI"},
                    "updated_at": "2024-01-01T00:00:00Z",
                    "pull_requests": pull_requests,
                },
                "repository": {
                    "html_url": "https://github.com/owner/repo",
                    "id": repository_id,
                },
            }
        )

    def _agent_state(self, *, run_id: int) -> SeerRunState:
        return SeerRunState(
            run_id=run_id,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")},
            metadata={"group_id": 1},
        )

    @patch(f"{CHECK_SUITES_PATH}.logger")
    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_warns_and_returns_first_when_multiple_matches(
        self,
        mock_resolve: MagicMock,
        mock_get_state: MagicMock,
        mock_logger: MagicMock,
    ) -> None:
        repo = MagicMock(organization_id=self.organization.id, id=2)
        mock_resolve.return_value = [repo]
        first = self._agent_state(run_id=111)
        second = self._agent_state(run_id=222)
        mock_get_state.side_effect = [first, second]

        result = resolve_check_suite_autofix_run(
            self._event(
                pull_requests=[own_repo_pr(111), own_repo_pr(222)], repository_id=OWN_REPO_ID
            )
        )

        assert result is not None
        assert result.run_state.run_id == 111
        assert result.pr_id == 111
        mock_logger.warning.assert_any_call(
            "autofix.pr_iteration.check_suite.multiple_autofix_runs",
            extra={
                "match_count": 2,
                "pr_ids": [111, 222],
                "run_ids": [111, 222],
                "organization_ids": [self.organization.id, self.organization.id],
            },
        )

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_skips_pull_request_based_in_another_repo(
        self, mock_resolve: MagicMock, mock_get_state: MagicMock
    ) -> None:
        """A PR with its head here and its base elsewhere is never an Autofix PR."""
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]

        result = resolve_check_suite_autofix_run(
            self._event(
                repository_id=123,
                pull_requests=[{"id": 111, "base": {"repo": {"id": 456}}}],
            )
        )

        assert result is None
        assert mock_get_state.call_count == 0

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_foreign_entry_does_not_shadow_own_repo_entry(
        self, mock_resolve: MagicMock, mock_get_state: MagicMock
    ) -> None:
        """The first match wins, so GitHub's ordering must not pick the run."""
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state(run_id=222)

        result = resolve_check_suite_autofix_run(
            self._event(
                repository_id=123,
                pull_requests=[
                    {"id": 111, "base": {"repo": {"id": 456}}},
                    {"id": 222, "base": {"repo": {"id": 123}}},
                ],
            )
        )

        assert result is not None
        assert result.pr_id == 222
        mock_get_state.assert_called_once_with(self.organization.id, "integrations:github", 222)

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_skips_entry_carrying_no_base_repo(
        self, mock_resolve: MagicMock, mock_get_state: MagicMock
    ) -> None:
        """An entry we cannot place is skipped, on the same rule pr_metrics uses.
        Resolving by global id could place it, but GitHub always sends base.repo, so
        this is not a payload shape that reaches us — see the legacy test below for
        why serialized feedback is not one either."""
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]

        result = resolve_check_suite_autofix_run(
            self._event(repository_id=123, pull_requests=[{"id": 111}])
        )

        assert result is None
        assert mock_get_state.call_count == 0

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_unplaceable_entry_does_not_shadow_own_repo_entry(
        self, mock_resolve: MagicMock, mock_get_state: MagicMock
    ) -> None:
        """Same shadowing guarantee as the foreign case, for the entry we cannot place."""
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state(run_id=222)

        result = resolve_check_suite_autofix_run(
            self._event(
                repository_id=123,
                pull_requests=[{"id": 111}, {"id": 222, "base": {"repo": {"id": 123}}}],
            )
        )

        assert result is not None
        assert result.pr_id == 222
        mock_get_state.assert_called_once_with(self.organization.id, "integrations:github", 222)

    @patch(f"{CHECK_SUITES_PATH}.get_agent_state_from_pr_id")
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories")
    def test_resolves_legacy_entry_round_tripped_through_the_old_model(
        self, mock_resolve: MagicMock, mock_get_state: MagicMock
    ) -> None:
        """Feedback serialized before `base` was declared still carries it: the model
        that predates the field had `extra = "allow"`, so `base` survived the round
        trip as an extra and parses into the field now. This is why skipping the
        unplaceable entry does not strand in-flight iterations."""
        mock_resolve.return_value = [MagicMock(organization_id=self.organization.id, id=2)]
        mock_get_state.return_value = self._agent_state(run_id=111)

        legacy_entry = {"id": 111, "number": 3, "base": {"repo": {"id": 123, "name": "x"}}}
        result = resolve_check_suite_autofix_run(
            self._event(repository_id=123, pull_requests=[legacy_entry])
        )

        assert result is not None
        assert result.pr_id == 111


def _run_state(*, blocks: list[MemoryBlock] | None = None) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks or [],
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
    )


def _autofix_run(*, blocks: list[MemoryBlock] | None = None) -> CheckSuiteAutofixRun:
    return CheckSuiteAutofixRun(
        repository=MagicMock(organization_id=1, id=2),
        run_state=_run_state(blocks=blocks or []),
        pr_id=1,
        group_id=1,
    )


def _check_suite_source() -> CheckSuiteFeedbackSource:
    source = CheckSuiteFeedbackSource(
        event={
            "check_suite": {
                "id": 1,
                "head_sha": "abc",
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
                "updated_at": "2024-01-01T00:00:00Z",
            },
            "repository": {
                "html_url": "https://github.com/owner/repo",
                "full_name": "owner/repo",
            },
        },
    )
    with patch(
        f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run", return_value=_autofix_run()
    ):
        _ = source.autofix_run
    return source


def _check_suite_feedback() -> Feedback:
    return Feedback(source=_check_suite_source())


def _review_comment_feedback(*, author_is_bot: bool) -> Feedback:
    """An inline review-comment feedback item, from a bot or a human reviewer.

    Bot reviews are automated (they share the streak with check suites); human
    reviews break it.
    """
    return Feedback(
        source=GithubPrReviewCommentFeedbackSource(
            comment=GithubPullRequestReviewComment(id=1, body="fix this"),
            author_is_bot=author_is_bot,
        )
    )


def _iteration_block(index: int, *feedbacks: Feedback) -> MemoryBlock:
    return MemoryBlock(
        id=f"iter-{index}",
        message=Message(
            role="assistant",
            metadata={
                "step": "pr_iteration",
                "iteration_index": str(index),
                "feedback": serialize_feedback(feedbacks),
            },
        ),
        timestamp="2024-01-01T00:00:00Z",
    )


def _empty_feedback_iteration_block(index: int) -> MemoryBlock:
    """PR_ITERATION whose feedback metadata parses to no items."""
    return MemoryBlock(
        id=f"iter-{index}",
        message=Message(
            role="assistant",
            metadata={
                "step": "pr_iteration",
                "iteration_index": str(index),
                "feedback": "[]",
            },
        ),
        timestamp="2024-01-01T00:00:00Z",
    )


class CheckSuiteHardCapTest(TestCase):
    # Consecutive-automated-iteration streak cap, shared with the review path and
    # backed by ``autofix.pr-iteration.max-iterations``. Set small so a few blocks
    # trip it.
    CAP = 3

    def setUp(self) -> None:
        super().setUp()
        self._options_ctx = self.options({"autofix.pr-iteration.max-iterations": self.CAP})
        self._options_ctx.__enter__()
        self.addCleanup(lambda: self._options_ctx.__exit__(None, None, None))

    def _source(self) -> CheckSuiteFeedbackSource:
        return _check_suite_source()

    def _run_state_on_head(self, *, blocks: list[MemoryBlock]) -> SeerRunState:
        state = _run_state(blocks=blocks)
        state.repo_pr_states = {"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")}
        return state

    def test_none_when_cap_reached(self) -> None:
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP)]

        assert self._source().should_trigger(_run_state(blocks=blocks)) == TriggerDecision(
            task=None, reason="hard_cap_reached"
        )

    def test_should_queue_false_when_cap_reached(self) -> None:
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP)]

        assert self._source().should_queue(self._run_state_on_head(blocks=blocks)) == Decision(
            ok=False, reason="hard_cap_reached"
        )

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_not_capped_when_fewer_than_cap_iterations(self, mock_new: MagicMock, _pages) -> None:
        mock_new.return_value = MagicMock()
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP - 1)]

        assert self._source().should_trigger(_run_state(blocks=blocks)) == TriggerDecision(
            task=ConsumeTask.Now, reason="sweep_complete"
        )

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_not_capped_when_one_iteration_has_human_feedback(
        self, mock_new: MagicMock, _pages
    ) -> None:
        # A human UI iteration mixed into the last N breaks the automated streak.
        mock_new.return_value = MagicMock()
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP - 1)]
        blocks.append(
            _iteration_block(
                self.CAP,
                _check_suite_feedback(),
                Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="fix it")),
            )
        )

        assert self._source().should_trigger(_run_state(blocks=blocks)) == TriggerDecision(
            task=ConsumeTask.Now, reason="sweep_complete"
        )

    def test_only_last_n_iterations_considered(self) -> None:
        blocks = [_iteration_block(0, Feedback(source=UserUIFeedbackSource(user_id=1)))]
        blocks += [_iteration_block(i, _check_suite_feedback()) for i in range(1, self.CAP + 1)]

        assert self._source().should_trigger(_run_state(blocks=blocks)) == TriggerDecision(
            task=None, reason="hard_cap_reached"
        )

    def test_none_when_mixed_automated_streak_reaches_cap(self) -> None:
        # Check suites and bot reviews share one streak: a mix of the two that
        # totals CAP consecutive automated iterations trips the cap.
        assert self.CAP >= 2
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP - 1)]
        blocks.append(_iteration_block(self.CAP - 1, _review_comment_feedback(author_is_bot=True)))

        assert self._source().should_trigger(_run_state(blocks=blocks)) == TriggerDecision(
            task=None, reason="hard_cap_reached"
        )

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_not_capped_when_human_review_breaks_mixed_streak(
        self, mock_new: MagicMock, _pages
    ) -> None:
        # A human review mixed into the automated (check-suite + bot-review) streak
        # resets it, so check-suite iteration resumes even at CAP iterations.
        mock_new.return_value = MagicMock()
        blocks = [_iteration_block(0, _check_suite_feedback())]
        blocks.append(_iteration_block(1, _review_comment_feedback(author_is_bot=False)))
        blocks += [
            _iteration_block(i, _review_comment_feedback(author_is_bot=True))
            for i in range(2, self.CAP + 1)
        ]

        assert self._source().should_trigger(_run_state(blocks=blocks)) == TriggerDecision(
            task=ConsumeTask.Now, reason="sweep_complete"
        )

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_cap_disabled_when_zero(self, mock_new: MagicMock, _pages) -> None:
        mock_new.return_value = MagicMock()
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(10)]

        with self.options({"autofix.pr-iteration.max-iterations": 0}):
            assert self._source().should_trigger(_run_state(blocks=blocks)) == TriggerDecision(
                task=ConsumeTask.Now, reason="sweep_complete"
            )

    @patch(f"{CHECK_SUITES_PATH}.iter_all_pages", return_value=[{"data": []}])
    @patch(f"{CHECK_SUITES_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_empty_after_parse_iteration_counts_as_automated(
        self, mock_new: MagicMock, _pages
    ) -> None:
        mock_new.return_value = MagicMock()
        # An iteration whose feedback parses to [] is a metadata gap, not human
        # input: it must not reset the automated streak (``iteration_is_automated``
        # treats no-feedback as automated), so a full window still trips the cap.
        blocks = [_iteration_block(i, _check_suite_feedback()) for i in range(self.CAP - 1)]
        blocks.append(_empty_feedback_iteration_block(self.CAP - 1))

        assert self._source().should_trigger(_run_state(blocks=blocks)) == TriggerDecision(
            task=None, reason="hard_cap_reached"
        )


class CheckSuiteFlagGateTest(TestCase):
    """The listener's front door: which organizations are behind an installation,
    and which of them hold the flags the asking branch can act on."""

    INSTALLATION_ID = 4242

    def _contexts(self, *organization_ids: int) -> MagicMock:
        return MagicMock(
            integration=MagicMock(),
            organization_integrations=[
                MagicMock(organization_id=organization_id) for organization_id in organization_ids
            ],
        )

    def _gate(self, flags=FAILING_CHECK_SUITE_FLAGS, raw: dict | None = None) -> CheckSuiteFlagGate:
        return resolve_check_suite_flag_gate(
            check_suite_event(raw, installation_id=self.INSTALLATION_ID), flags
        )

    def test_no_installation_id_resolves_nothing(self) -> None:
        # ``extra`` is populated by the GitHub webhook endpoint; without it there
        # is no installation to look up, and no body parse to fall back on.
        gate = resolve_check_suite_flag_gate(check_suite_event(), FAILING_CHECK_SUITE_FLAGS)

        assert gate.organization_ids == []
        assert gate.flagged_organization_ids == []

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_organization_without_flags_is_not_admitted(self, mock_contexts: MagicMock) -> None:
        mock_contexts.return_value = self._contexts(self.organization.id)

        gate = self._gate()

        assert gate.organization_ids == [self.organization.id]
        assert gate.flagged_organization_ids == []
        assert gate.organization_ids_by_flag == {flag: [] for flag in FAILING_CHECK_SUITE_FLAGS}

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_automated_iteration_flag_admits_a_failing_suite(
        self, mock_contexts: MagicMock
    ) -> None:
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({ITERATION_FLAG: True}):
            gate = self._gate()

        assert gate.flagged_organization_ids == [self.organization.id]
        assert gate.organization_ids_by_flag[ITERATION_FLAG] == [self.organization.id]
        assert gate.organization_ids_by_flag[MANUAL_FLAG] == []

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_manual_flag_admits_a_failing_suite(self, mock_contexts: MagicMock) -> None:
        # The manual flag drives comment and review triggers rather than CI, but
        # ``trigger_autofix_agent`` admits the PR_ITERATION step under it too, so a
        # failing suite still has iteration to reach.
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({MANUAL_FLAG: True}):
            gate = self._gate()

        assert gate.flagged_organization_ids == [self.organization.id]

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_cap_assign_flag_alone_does_not_admit(self, mock_contexts: MagicMock) -> None:
        # The cap-exhausted handoff only reacts to iteration that already ran, so
        # it is never the sole reason to resolve a suite -- an organization holding
        # it without an iteration flag has nothing to hand over.
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({CAP_ASSIGN_FLAG: True}):
            gate = self._gate()

        assert gate.organization_ids == [self.organization.id]
        assert gate.flagged_organization_ids == []

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_review_request_flag_admits_a_green_suite(self, mock_contexts: MagicMock) -> None:
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({REVIEW_REQUEST_FLAG: True}):
            gate = self._gate(GREEN_CHECK_SUITE_FLAGS)

        assert gate.flagged_organization_ids == [self.organization.id]
        assert gate.organization_ids_by_flag[REVIEW_REQUEST_FLAG] == [self.organization.id]
        assert gate.organization_ids_by_flag[ITERATION_FLAG] == []
        assert gate.organization_ids_by_flag[MANUAL_FLAG] == []

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_iteration_flag_admits_a_green_suite(self, mock_contexts: MagicMock) -> None:
        # A green suite is also what releases feedback parked by an earlier failing
        # suite, so an org that only iterates on CI failures must survive the green
        # gate -- otherwise its parked feedback waits out the full deferral.
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({ITERATION_FLAG: True}):
            gate = self._gate(GREEN_CHECK_SUITE_FLAGS)

        assert gate.flagged_organization_ids == [self.organization.id]
        assert gate.organization_ids_by_flag[ITERATION_FLAG] == [self.organization.id]
        assert gate.organization_ids_by_flag[REVIEW_REQUEST_FLAG] == []

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_review_request_alone_does_not_admit_a_failing_suite(
        self, mock_contexts: MagicMock
    ) -> None:
        # The point of asking per conclusion: an organization that only
        # review-requests has nothing to do with a failing suite. The reverse is
        # not symmetric -- see ``test_iteration_flag_admits_a_green_suite``.
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({REVIEW_REQUEST_FLAG: True}):
            failing = self._gate(FAILING_CHECK_SUITE_FLAGS)

        assert failing.organization_ids == [self.organization.id]
        assert failing.flagged_organization_ids == []

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_admits_only_the_flagged_half_of_a_shared_installation(
        self, mock_contexts: MagicMock
    ) -> None:
        # One GitHub App installation, two Sentry organizations. The event is kept
        # for the whole installation, but only one organization is the reason.
        other_organization = self.create_organization()
        mock_contexts.return_value = self._contexts(self.organization.id, other_organization.id)

        with self.feature({ITERATION_FLAG: [other_organization.slug]}):
            gate = self._gate()

        assert gate.organization_ids == [self.organization.id, other_organization.id]
        assert gate.flagged_organization_ids == [other_organization.id]
        assert gate.organization_ids_by_flag[ITERATION_FLAG] == [other_organization.id]

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_flagged_organizations_are_deduped_across_flags(self, mock_contexts: MagicMock) -> None:
        # One organization holding two of the branch's flags is one reason to keep
        # the event, not two.
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({ITERATION_FLAG: True, MANUAL_FLAG: True}):
            gate = self._gate()

        assert gate.flagged_organization_ids == [self.organization.id]
        assert gate.organization_ids_by_flag[ITERATION_FLAG] == [self.organization.id]
        assert gate.organization_ids_by_flag[MANUAL_FLAG] == [self.organization.id]

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_installation_with_no_organizations(self, mock_contexts: MagicMock) -> None:
        mock_contexts.return_value = MagicMock(integration=None, organization_integrations=[])

        gate = self._gate()

        assert gate.organization_ids == []
        assert gate.flagged_organization_ids == []

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_skips_organizations_that_no_longer_exist(self, mock_contexts: MagicMock) -> None:
        # An OrganizationIntegration can outlive its organization; the flag check
        # needs the real row, so such an entry is counted but never admitted.
        mock_contexts.return_value = self._contexts(self.organization.id + 10_000)

        with self.feature({ITERATION_FLAG: True}):
            gate = self._gate()

        assert gate.organization_ids == [self.organization.id + 10_000]
        assert gate.flagged_organization_ids == []

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_does_not_parse_the_event_body(self, mock_contexts: MagicMock) -> None:
        # The installation id comes off ``extra``, so a body the green/failure
        # branches would reject still gets a verdict here.
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({ITERATION_FLAG: True}):
            gate = self._gate(raw={"nonsense": True})

        assert gate.flagged_organization_ids == [self.organization.id]

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_flag_gate_and_repository_resolve_share_one_rpc(self, mock_contexts: MagicMock) -> None:
        mock_contexts.return_value = self._contexts(self.organization.id)
        event = GithubCheckSuiteEvent.parse_obj(
            {
                "check_suite": {
                    "id": 1,
                    "head_sha": "abc",
                    "check_runs_url": "https://github.com/owner/repo/check-runs",
                    "app": {"name": "CI"},
                },
                "repository": {"id": 2, "html_url": "https://github.com/owner/repo"},
                "installation": {"id": self.INSTALLATION_ID},
            }
        )

        self._gate()
        resolve_check_suite_repositories(event)

        mock_contexts.assert_called_once()


def _live_pr_result(head_sha: str = "abc") -> dict:
    return {
        "data": {"state": "open", "merged": False, "head": {"sha": head_sha}},
        "raw": {"headers": None, "data": {}},
        "type": "github",
        "meta": {},
    }


class CheckSuiteLiveHeadTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.get_pr = MagicMock(return_value=_live_pr_result())
        for patcher in (
            patch(f"{CHECK_SUITES_PATH}.scm_actions.get_pull_request", self.get_pr),
            patch(f"{CHECK_SUITES_PATH}.GetPullRequestProtocol", object),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        scm_patcher = patch("sentry.scm.factory.new", return_value=MagicMock())
        self.mock_make_scm = scm_patcher.start()
        self.addCleanup(scm_patcher.stop)

    def _run_state_on_head(self, *, pr_number: int | None = 7) -> SeerRunState:
        state = _run_state()
        state.repo_pr_states = {
            "owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc", pr_number=pr_number)
        }
        return state

    def test_consumes_when_live_head_is_the_head_the_suite_ran_on(self) -> None:
        assert _check_suite_source().should_consume(self._run_state_on_head()).ok
        assert self.get_pr.call_args[0][1] == "7"

    def test_skips_when_live_head_moved_past_the_suite(self) -> None:
        self.get_pr.return_value = _live_pr_result("def")

        assert not _check_suite_source().should_consume(self._run_state_on_head()).ok

    def test_consumes_when_github_has_no_head_sha(self) -> None:
        self.get_pr.return_value = _live_pr_result("")

        assert _check_suite_source().should_consume(self._run_state_on_head()).ok

    def test_consumes_when_get_pull_request_raises(self) -> None:
        self.get_pr.side_effect = Exception("boom")

        assert _check_suite_source().should_consume(self._run_state_on_head()).ok

    def test_consumes_when_scm_init_fails(self) -> None:
        self.mock_make_scm.side_effect = Exception("boom")

        assert _check_suite_source().should_consume(self._run_state_on_head()).ok

    def test_skips_live_head_read_without_a_pr_number(self) -> None:
        assert _check_suite_source().should_consume(self._run_state_on_head(pr_number=None)).ok
        assert not self.get_pr.called

    def test_skips_live_head_read_when_suite_is_not_on_the_run_head(self) -> None:
        state = self._run_state_on_head()
        state.repo_pr_states["owner/repo"].commit_sha = "def"

        assert not _check_suite_source().should_consume(state).ok
        assert not self.get_pr.called

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.metrics")
    def test_records_the_live_head_result(self, mock_metrics: MagicMock) -> None:
        self.get_pr.return_value = _live_pr_result("def")

        _check_suite_source().should_consume(self._run_state_on_head())

        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.check_suite.live_head", tags={"result": "mismatch"}
        )

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.logger")
    def test_consumes_and_reports_when_resolving_the_repository_raises(
        self, mock_logger: MagicMock
    ) -> None:
        source = _check_suite_source()
        with patch.object(
            type(source),
            "autofix_run",
            new_callable=lambda: property(lambda self: (_ for _ in ()).throw(Exception("rpc"))),
        ):
            assert source.should_consume(self._run_state_on_head()).ok

        assert mock_logger.exception.call_count == 1

    @patch(f"{CHECK_SUITES_PATH}.logger")
    def test_consumes_and_reports_when_get_pull_request_raises(
        self, mock_logger: MagicMock
    ) -> None:
        self.get_pr.side_effect = Exception("boom")

        assert _check_suite_source().should_consume(self._run_state_on_head()).ok
        assert mock_logger.exception.call_count == 1

    @patch(f"{CHECK_SUITES_PATH}.metrics")
    def test_counts_a_pruning_request_as_useful(self, mock_metrics: MagicMock) -> None:
        self.get_pr.return_value = _live_pr_result("def")

        _check_suite_source().should_consume(self._run_state_on_head())

        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.check_suite.live_head.github_request",
            tags={"outcome": "useful"},
        )

    @patch(f"{CHECK_SUITES_PATH}.metrics")
    def test_counts_a_confirming_request_as_not_useful(self, mock_metrics: MagicMock) -> None:
        _check_suite_source().should_consume(self._run_state_on_head())

        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.check_suite.live_head.github_request",
            tags={"outcome": "not_useful"},
        )

    @patch(f"{CHECK_SUITES_PATH}.metrics")
    def test_counts_a_failed_request_as_not_useful(self, mock_metrics: MagicMock) -> None:
        self.get_pr.side_effect = Exception("boom")

        _check_suite_source().should_consume(self._run_state_on_head())

        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.check_suite.live_head.github_request",
            tags={"outcome": "not_useful"},
        )

    @patch(f"{CHECK_SUITES_PATH}.metrics")
    def test_counts_no_github_request_when_we_never_reach_github(
        self, mock_metrics: MagicMock
    ) -> None:
        self.mock_make_scm.side_effect = Exception("boom")

        _check_suite_source().should_consume(self._run_state_on_head())

        assert not mock_metrics.incr.called

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.metrics")
    def test_records_nothing_when_the_cheap_checks_already_declined(
        self, mock_metrics: MagicMock
    ) -> None:
        state = self._run_state_on_head()
        state.repo_pr_states["owner/repo"].commit_sha = "def"

        _check_suite_source().should_consume(state)

        assert not mock_metrics.incr.called
