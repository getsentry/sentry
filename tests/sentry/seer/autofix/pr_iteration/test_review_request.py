from typing import Any
from unittest.mock import MagicMock, patch

import orjson

from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.check_suites import CheckRunsSweep, CheckSuiteAutofixRun
from sentry.seer.autofix.pr_iteration.review_request import (
    REVIEW_REQUESTS_EXTRA,
    request_review_for_green_check_suite,
)
from sentry.seer.autofix.pr_iteration.reviewer_candidates import (
    REVIEWER_CANDIDATES_EXTRA,
    SOURCE_TRIGGERING_USER,
    ReviewerCandidate,
)
from sentry.seer.models.run import SeerRun
from sentry.testutils.cases import TestCase

REVIEW_REQUEST_PATH = "sentry.seer.autofix.pr_iteration.review_request"
CANDIDATES_PATH = "sentry.seer.autofix.pr_iteration.reviewer_candidates"
FLAG = "organizations:autofix-pr-iteration-review-request"

RUN_ID = 67890
REPO_NAME = "owner/repo"
HEAD_SHA = "abc"
PR_NUMBER = 42

GREEN_SWEEP = CheckRunsSweep(total=3, incomplete=0, failed=0)


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


def _pull_request_result(
    *,
    state: str = "open",
    merged: bool = False,
    requested_reviewers: list[dict] | None = None,
    author: str | None = None,
) -> dict:
    raw: dict[str, Any] = {"requested_reviewers": requested_reviewers or []}
    if author is not None:
        raw["user"] = {"login": author}
    return {
        "data": {"state": state, "merged": merged},
        "raw": {"headers": None, "data": raw},
        "type": "github",
        "meta": {},
    }


class RequestReviewForGreenCheckSuiteTest(TestCase):
    """End-to-end through the real candidate collection."""

    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name=REPO_NAME
        )
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )
        repos_patcher = patch(
            f"{REVIEW_REQUEST_PATH}.resolve_check_suite_repositories", return_value=[self.repo]
        )
        repos_patcher.start()
        self.addCleanup(repos_patcher.stop)

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

    def _marker(self, extra_key: str = REVIEW_REQUESTS_EXTRA) -> dict | None:
        self.seer_run.refresh_from_db()
        return (self.seer_run.extras or {}).get(extra_key, {}).get(REPO_NAME)

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    @patch(f"{REVIEW_REQUEST_PATH}.GetPullRequestProtocol", object)
    @patch(f"{REVIEW_REQUEST_PATH}.RequestReviewProtocol", object)
    def test_requests_review_from_triggering_user(
        self,
        mock_resolve: MagicMock,
        _mock_username: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        scm, pr_number, reviewers = mock_actions.request_review.call_args[0]
        assert pr_number == str(PR_NUMBER)
        assert reviewers == ["octocat"]
        marker = self._marker()
        assert marker is not None
        assert marker["reviewers"] == ["octocat"]
        assert marker["head_sha"] == HEAD_SHA
        assert marker["requested_at"]
        candidates_marker = self._marker(REVIEWER_CANDIDATES_EXTRA)
        assert candidates_marker is not None
        assert candidates_marker["candidates"] == [
            {"login": "octocat", "source": SOURCE_TRIGGERING_USER}
        ]

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    def test_noop_when_flag_disabled(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()

        request_review_for_green_check_suite(_green_event())

        # The flag gate runs before any Seer lookup so disabled orgs cost nothing.
        mock_resolve.assert_not_called()
        mock_actions.request_review.assert_not_called()
        assert self._marker() is None

    @patch(f"{REVIEW_REQUEST_PATH}.metrics")
    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run", return_value=None)
    def test_noop_when_no_run_resolved(
        self, _mock_resolve: MagicMock, mock_actions: MagicMock, mock_metrics: MagicMock
    ) -> None:
        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()
        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.review_request.run_resolved", tags={"found": "false"}
        )

    @patch(f"{REVIEW_REQUEST_PATH}.sentry_sdk.capture_exception")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    def test_invalid_payload_captures_and_returns(
        self, mock_resolve: MagicMock, mock_capture: MagicMock
    ) -> None:
        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event(raw={"check_suite": {"id": 1}}))

        mock_capture.assert_called_once()
        mock_resolve.assert_not_called()

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    def test_skips_stale_head(self, mock_resolve: MagicMock, mock_actions: MagicMock) -> None:
        mock_resolve.return_value = self._resolved(commit_sha="newer-sha")

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()
        assert self._marker() is None

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    @patch(f"{REVIEW_REQUEST_PATH}.GetPullRequestProtocol", object)
    @patch(f"{REVIEW_REQUEST_PATH}.RequestReviewProtocol", object)
    def test_skips_night_shift_run_without_candidates(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        # No triggering user, so no candidate resolves.
        self.seer_run.update(user_id=None)
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()
        assert self._marker() is None

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    def test_skips_when_no_seer_run_row(
        self, mock_resolve: MagicMock, mock_actions: MagicMock
    ) -> None:
        self.seer_run.delete()
        mock_resolve.return_value = self._resolved()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    def test_skips_when_already_requested(
        self, mock_resolve: MagicMock, mock_actions: MagicMock
    ) -> None:
        self.seer_run.update(
            extras={
                REVIEW_REQUESTS_EXTRA: {
                    REPO_NAME: {
                        "requested_at": "2024-01-01T00:00:00+00:00",
                        "head_sha": "older-sha",
                        "reviewers": ["octocat"],
                    }
                }
            }
        )
        mock_resolve.return_value = self._resolved()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        # The marker pre-check must short-circuit before any SCM work.
        mock_actions.get_pull_request.assert_not_called()
        mock_actions.request_review.assert_not_called()

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value=None)
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    @patch(f"{REVIEW_REQUEST_PATH}.GetPullRequestProtocol", object)
    @patch(f"{REVIEW_REQUEST_PATH}.RequestReviewProtocol", object)
    def test_skips_when_no_candidate_resolves(
        self,
        mock_resolve: MagicMock,
        _mock_username: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()
        assert self._marker() is None

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=None)
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    def test_skips_when_sweep_fails(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(
        f"{REVIEW_REQUEST_PATH}.sweep_check_runs",
        return_value=CheckRunsSweep(total=3, incomplete=1, failed=0),
    )
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    def test_skips_when_checks_incomplete(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(
        f"{REVIEW_REQUEST_PATH}.sweep_check_runs",
        return_value=CheckRunsSweep(total=3, incomplete=0, failed=1),
    )
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    def test_skips_when_checks_failed(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    @patch(f"{REVIEW_REQUEST_PATH}.GetPullRequestProtocol", object)
    @patch(f"{REVIEW_REQUEST_PATH}.RequestReviewProtocol", object)
    def test_skips_when_pr_not_open(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result(
            state="closed", merged=True
        )

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()
        assert self._marker() is None

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    @patch(f"{REVIEW_REQUEST_PATH}.GetPullRequestProtocol", object)
    @patch(f"{REVIEW_REQUEST_PATH}.RequestReviewProtocol", object)
    def test_skips_when_already_in_requested_reviewers(
        self,
        mock_resolve: MagicMock,
        _mock_username: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result(
            requested_reviewers=[{"login": "Octocat"}]
        )

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()
        # The existing request is recorded as a preexisting marker so later
        # green events short-circuit before any SCM calls.
        marker = self._marker()
        assert marker is not None
        assert marker["reviewers"] == ["octocat"]
        assert marker["preexisting"] is True

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    @patch(f"{REVIEW_REQUEST_PATH}.GetPullRequestProtocol", object)
    @patch(f"{REVIEW_REQUEST_PATH}.RequestReviewProtocol", object)
    def test_request_failure_leaves_marker_unset(
        self,
        mock_resolve: MagicMock,
        _mock_username: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result()
        mock_actions.request_review.side_effect = Exception("boom")

        with self.feature(FLAG), patch(f"{REVIEW_REQUEST_PATH}.metrics") as mock_metrics:
            request_review_for_green_check_suite(_green_event())

        assert self._marker() is None
        mock_metrics.incr.assert_any_call(
            "autofix.pr_iteration.review_request.failed", tags={"reason": "request_review_failed"}
        )

    @patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
    @patch(f"{REVIEW_REQUEST_PATH}.GetPullRequestProtocol", object)
    @patch(f"{REVIEW_REQUEST_PATH}.RequestReviewProtocol", object)
    def test_skips_when_run_deleted_before_marker_write(
        self,
        mock_resolve: MagicMock,
        _mock_username: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result()

        with (
            self.feature(FLAG),
            patch.object(SeerRun, "refresh_from_db", side_effect=SeerRun.DoesNotExist),
        ):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()


# Provenance is opaque to the request flow — the wiring must work for any
# ranked list the collector produces.
CANDIDATES = [
    ReviewerCandidate(login="reviewer-one", source="source-one"),
    ReviewerCandidate(login="reviewer-two", source="source-two"),
]


@patch(f"{REVIEW_REQUEST_PATH}.collect_reviewer_candidates", return_value=CANDIDATES)
@patch(f"{REVIEW_REQUEST_PATH}.scm_actions")
@patch("sentry.scm.factory.new", return_value=MagicMock())
@patch(f"{REVIEW_REQUEST_PATH}.sweep_check_runs", return_value=GREEN_SWEEP)
@patch(f"{REVIEW_REQUEST_PATH}.resolve_check_suite_autofix_run")
@patch(f"{REVIEW_REQUEST_PATH}.GetPullRequestProtocol", object)
@patch(f"{REVIEW_REQUEST_PATH}.RequestReviewProtocol", object)
class RequestReviewFromCandidatesTest(TestCase):
    """Wiring of the (mocked) candidate list into the request flow: markers,
    the preexisting-reviewer check, and request-failure fallback."""

    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name=REPO_NAME
        )
        # A system run: candidate selection must work without a triggering user.
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=None
        )
        repos_patcher = patch(
            f"{REVIEW_REQUEST_PATH}.resolve_check_suite_repositories", return_value=[self.repo]
        )
        repos_patcher.start()
        self.addCleanup(repos_patcher.stop)

    def _resolved(self) -> CheckSuiteAutofixRun:
        run_state = SeerRunState(
            run_id=RUN_ID,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                REPO_NAME: RepoPRState(
                    repo_name=REPO_NAME, commit_sha=HEAD_SHA, pr_number=PR_NUMBER
                )
            },
        )
        return CheckSuiteAutofixRun(
            repository=self.repo, run_state=run_state, pr_id=555, group_id=1
        )

    def _marker(self, extra_key: str = REVIEW_REQUESTS_EXTRA) -> dict | None:
        self.seer_run.refresh_from_db()
        return (self.seer_run.extras or {}).get(extra_key, {}).get(REPO_NAME)

    def test_requests_top_candidate_and_records_provenance(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        mock_collect: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result(author="seer[bot]")

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        _scm, pr_number, reviewers = mock_actions.request_review.call_args[0]
        assert pr_number == str(PR_NUMBER)
        assert reviewers == ["reviewer-one"]
        assert mock_collect.call_args.kwargs["exclude_logins"] == {"seer[bot]"}
        marker = self._marker()
        assert marker is not None
        assert marker["reviewers"] == ["reviewer-one"]
        candidates_marker = self._marker(REVIEWER_CANDIDATES_EXTRA)
        assert candidates_marker is not None
        assert candidates_marker["head_sha"] == HEAD_SHA
        assert candidates_marker["candidates"] == [
            {"login": "reviewer-one", "source": "source-one"},
            {"login": "reviewer-two", "source": "source-two"},
        ]

    def test_skips_when_no_candidates(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        mock_collect: MagicMock,
    ) -> None:
        mock_collect.return_value = []
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result()

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()
        assert self._marker() is None
        assert self._marker(REVIEWER_CANDIDATES_EXTRA) is None

    def test_records_preexisting_when_any_candidate_already_requested(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_collect: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        # The lower-ranked candidate is already on the hook (e.g. CODEOWNERS
        # auto-request) — adding a second person would rebuild the bystander
        # effect, so no request is made.
        mock_actions.get_pull_request.return_value = _pull_request_result(
            requested_reviewers=[{"login": "Reviewer-Two"}]
        )

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        mock_actions.request_review.assert_not_called()
        marker = self._marker()
        assert marker is not None
        assert marker["reviewers"] == ["reviewer-two"]
        assert marker["preexisting"] is True

    def test_falls_back_to_next_candidate_when_request_fails(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_collect: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result()
        mock_actions.request_review.side_effect = [Exception("no repo access"), None]

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        _scm, _pr_number, reviewers = mock_actions.request_review.call_args[0]
        assert reviewers == ["reviewer-two"]
        marker = self._marker()
        assert marker is not None
        assert marker["reviewers"] == ["reviewer-two"]

    def test_no_request_marker_when_all_attempts_fail(
        self,
        mock_resolve: MagicMock,
        _mock_sweep: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_collect: MagicMock,
    ) -> None:
        mock_resolve.return_value = self._resolved()
        mock_actions.get_pull_request.return_value = _pull_request_result()
        mock_actions.request_review.side_effect = Exception("no repo access")

        with self.feature(FLAG):
            request_review_for_green_check_suite(_green_event())

        assert mock_actions.request_review.call_count == len(CANDIDATES)
        # The request marker stays unset so the next green event retries, but
        # the computed candidates are kept as re-request fallbacks.
        assert self._marker() is None
        assert self._marker(REVIEWER_CANDIDATES_EXTRA) is not None
