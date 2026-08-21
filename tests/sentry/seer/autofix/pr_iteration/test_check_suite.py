from unittest.mock import MagicMock, patch

import orjson

from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.check_suites import (
    CheckSuiteAutofixRun,
    CheckSuiteFlagGate,
    GithubCheckSuiteEvent,
    resolve_check_suite_autofix_run,
    resolve_check_suite_flag_gate,
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
from sentry.testutils.cases import TestCase

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
    ) -> None:
        mock_resolve.return_value = MagicMock()

        pr_iteration_from_check_suite_listener(self._event(self._raw(), conclusion="success"))

        mock_confirm.assert_not_called()
        mock_mark_ready.assert_not_called()
        mock_request_review.assert_not_called()
        mock_get_state.assert_not_called()

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
        assert gate.organization_ids_by_flag == {REVIEW_REQUEST_FLAG: [self.organization.id]}

    @patch(f"{CHECK_SUITES_PATH}.integration_service.organization_contexts")
    def test_branches_do_not_admit_each_other(self, mock_contexts: MagicMock) -> None:
        # The point of asking per conclusion: an organization that only iterates on
        # CI failures has nothing to do with a green suite, and one that only
        # review-requests has nothing to do with a failing one.
        mock_contexts.return_value = self._contexts(self.organization.id)

        with self.feature({ITERATION_FLAG: True, MANUAL_FLAG: True}):
            green = self._gate(GREEN_CHECK_SUITE_FLAGS)
        with self.feature({REVIEW_REQUEST_FLAG: True}):
            failing = self._gate(FAILING_CHECK_SUITE_FLAGS)

        assert green.organization_ids == [self.organization.id]
        assert green.flagged_organization_ids == []
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
