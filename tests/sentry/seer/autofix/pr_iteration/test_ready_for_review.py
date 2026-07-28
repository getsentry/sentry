from unittest.mock import MagicMock, patch

import orjson

from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.check_suites import (
    READY_FOR_REVIEW_EXTRA,
    CheckRunsSweep,
    CheckSuiteAutofixRun,
    bootstrap_green_check_suite,
)
from sentry.seer.autofix.pr_iteration.constants import REVIEW_REQUEST_FLAG
from sentry.seer.autofix.pr_iteration.ready_for_review import mark_ready_for_review
from sentry.testutils.cases import TestCase

READY_FOR_REVIEW_PATH = "sentry.seer.autofix.pr_iteration.ready_for_review"
CHECK_SUITES_PATH = "sentry.seer.autofix.pr_iteration.check_suites"

RUN_ID = 67890
REPO_NAME = "owner/repo"
HEAD_SHA = "abc"
PR_NUMBER = 42

GREEN_SWEEP = CheckRunsSweep(total=3, incomplete=0, failed=0)


def _pull_request_result(
    *,
    head_sha: str = HEAD_SHA,
    draft: bool = True,
    state: str = "open",
    merged: bool = False,
) -> dict:
    return {
        "data": {"state": state, "merged": merged, "head": {"sha": head_sha}},
        "raw": {"headers": None, "data": {"draft": draft}},
        "type": "github",
        "meta": {},
    }


def _green_event(raw: dict | None = None) -> CheckSuiteEvent:
    if raw is None:
        raw = {
            "check_suite": {
                "id": 1,
                "head_sha": HEAD_SHA,
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
            },
            "repository": {"html_url": "https://github.com/owner/repo", "full_name": REPO_NAME},
        }
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
            "event": orjson.dumps(raw).decode(),
            "event_type_hint": "check_suite",
            "extra": {},
            "received_at": 0,
            "sentry_meta": None,
            "type": "github",
        },
    )


def _mark_ready(event: CheckSuiteEvent | None = None) -> None:
    ctx = bootstrap_green_check_suite(event or _green_event())
    if ctx is None:
        return
    mark_ready_for_review(ctx)


class MarkReadyForReviewTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name=REPO_NAME
        )
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )
        repos_patcher = patch(
            f"{CHECK_SUITES_PATH}.resolve_check_suite_repositories", return_value=[self.repo]
        )
        repos_patcher.start()
        self.addCleanup(repos_patcher.stop)
        self.get_pr = MagicMock(return_value=_pull_request_result())
        get_pr_patcher = patch(f"{CHECK_SUITES_PATH}.scm_actions.get_pull_request", self.get_pr)
        get_pr_patcher.start()
        self.addCleanup(get_pr_patcher.stop)
        # MagicMock does not satisfy runtime_checkable SCM protocols.
        proto_patcher = patch(f"{CHECK_SUITES_PATH}.GetPullRequestProtocol", object)
        proto_patcher.start()
        self.addCleanup(proto_patcher.stop)
        sweep_patcher = patch(f"{CHECK_SUITES_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
        sweep_patcher.start()
        self.addCleanup(sweep_patcher.stop)

    def _resolved(self, *, commit_sha: str = HEAD_SHA) -> CheckSuiteAutofixRun:
        run_state = SeerRunState(
            run_id=RUN_ID,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                REPO_NAME: RepoPRState(
                    repo_name=REPO_NAME, commit_sha=commit_sha, pr_number=PR_NUMBER
                )
            },
        )
        return CheckSuiteAutofixRun(
            repository=self.repo, run_state=run_state, pr_id=555, group_id=1
        )

    def _marker(self) -> dict | None:
        self.seer_run.refresh_from_db()
        return (self.seer_run.extras or {}).get(READY_FOR_REVIEW_EXTRA, {}).get(REPO_NAME)

    @patch(f"{READY_FOR_REVIEW_PATH}.MarkPullRequestDraftStateProtocol", object)
    @patch(f"{READY_FOR_REVIEW_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_autofix_run")
    def test_undrafts(
        self,
        mock_resolve: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        # Live PR head matches the suite even if run_state.commit_sha is stale.
        mock_resolve.return_value = self._resolved(commit_sha="stale-run-state")

        with self.feature(REVIEW_REQUEST_FLAG):
            _mark_ready(_green_event())

        marker = self._marker()
        assert marker is not None
        assert marker["head_sha"] == HEAD_SHA
        mock_actions.mark_pull_request_ready_for_review.assert_called_once()
        _scm, pr_number = mock_actions.mark_pull_request_ready_for_review.call_args[0]
        assert pr_number == str(PR_NUMBER)

    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_autofix_run")
    def test_noop_when_flag_disabled(self, mock_resolve: MagicMock) -> None:
        _mark_ready(_green_event())
        mock_resolve.assert_not_called()
        assert self._marker() is None

    @patch(f"{READY_FOR_REVIEW_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_autofix_run")
    def test_skips_stale_head(
        self,
        mock_resolve: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        self.get_pr.return_value = _pull_request_result(head_sha="newer")

        with self.feature(REVIEW_REQUEST_FLAG):
            _mark_ready(_green_event())

        assert self._marker() is None
        mock_actions.mark_pull_request_ready_for_review.assert_not_called()

    @patch(f"{READY_FOR_REVIEW_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(
        f"{CHECK_SUITES_PATH}.sweep_check_runs",
        return_value=CheckRunsSweep(total=2, incomplete=1, failed=0),
    )
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_autofix_run")
    def test_skips_when_not_green(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()

        with self.feature(REVIEW_REQUEST_FLAG):
            _mark_ready(_green_event())

        assert self._marker() is None
        mock_actions.mark_pull_request_ready_for_review.assert_not_called()

    @patch(f"{READY_FOR_REVIEW_PATH}.MarkPullRequestDraftStateProtocol", object)
    @patch(f"{READY_FOR_REVIEW_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_autofix_run")
    def test_undraft_failure_leaves_marker_unset(
        self,
        mock_resolve: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.mark_pull_request_ready_for_review.side_effect = RuntimeError("boom")

        with self.feature(REVIEW_REQUEST_FLAG):
            _mark_ready(_green_event())

        assert self._marker() is None

    @patch(f"{READY_FOR_REVIEW_PATH}.MarkPullRequestDraftStateProtocol", object)
    @patch(f"{READY_FOR_REVIEW_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_autofix_run")
    def test_skips_when_marker_exists_for_any_head(
        self,
        mock_resolve: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        # Sticky: prior undraft on an older SHA must not undraft a new tip.
        self.seer_run.update(
            extras={
                READY_FOR_REVIEW_EXTRA: {
                    REPO_NAME: {
                        "marked_at": "2024-01-01T00:00:00+00:00",
                        "head_sha": "older-sha",
                    }
                }
            }
        )
        mock_resolve.return_value = self._resolved()

        with self.feature(REVIEW_REQUEST_FLAG):
            _mark_ready(_green_event())

        mock_actions.mark_pull_request_ready_for_review.assert_not_called()
        marker = self._marker()
        assert marker is not None
        assert marker["head_sha"] == "older-sha"

    @patch(f"{READY_FOR_REVIEW_PATH}.MarkPullRequestDraftStateProtocol", object)
    @patch(f"{READY_FOR_REVIEW_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_autofix_run")
    def test_skips_undraft_when_pr_not_draft(
        self,
        mock_resolve: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        self.get_pr.return_value = _pull_request_result(draft=False)

        with self.feature(REVIEW_REQUEST_FLAG):
            _mark_ready(_green_event())

        mock_actions.mark_pull_request_ready_for_review.assert_not_called()
        marker = self._marker()
        assert marker is not None
        assert marker["head_sha"] == HEAD_SHA

    @patch(f"{READY_FOR_REVIEW_PATH}.MarkPullRequestDraftStateProtocol", object)
    @patch(f"{READY_FOR_REVIEW_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CHECK_SUITES_PATH}.resolve_check_suite_autofix_run")
    def test_skips_undraft_when_pr_not_open(
        self,
        mock_resolve: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        self.get_pr.return_value = _pull_request_result(state="closed", merged=True)

        with self.feature(REVIEW_REQUEST_FLAG):
            _mark_ready(_green_event())

        mock_actions.mark_pull_request_ready_for_review.assert_not_called()
        # Sticky marker so later green suites don't keep confirming + undrafting.
        marker = self._marker()
        assert marker is not None
        assert marker["head_sha"] == HEAD_SHA
