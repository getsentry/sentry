from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.cap_exhausted import (
    CAP_EXHAUSTED_EXTRA,
    assign_user_for_exhausted_cap,
)
from sentry.seer.autofix.pr_iteration.check_suites import (
    CheckSuiteAutofixRun,
    GithubCheckSuiteEvent,
)
from sentry.seer.models.run import SeerRun
from sentry.testutils.cases import TestCase

CAP_EXHAUSTED_PATH = "sentry.seer.autofix.pr_iteration.cap_exhausted"
FLAG = "organizations:autofix-pr-iteration-cap-assign"

RUN_ID = 67890
REPO_NAME = "owner/repo"
HEAD_SHA = "abc"
PR_NUMBER = 42


def _event(head_sha: str = HEAD_SHA) -> GithubCheckSuiteEvent:
    return GithubCheckSuiteEvent.parse_obj(
        {
            "check_suite": {
                "id": 1,
                "head_sha": head_sha,
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
                "conclusion": "failure",
            },
            "repository": {"html_url": "https://github.com/owner/repo", "full_name": REPO_NAME},
        }
    )


def _pull_request_result(
    *, state: str = "open", merged: bool = False, assignees: list[dict] | None = None
) -> dict:
    return {
        "data": {"state": state, "merged": merged},
        "raw": {"headers": None, "data": {"assignees": assignees or []}},
        "type": "github",
        "meta": {},
    }


@patch(f"{CAP_EXHAUSTED_PATH}.automated_iteration_cap_reached", return_value=True)
class AssignUserForExhaustedCapTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name=REPO_NAME
        )
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

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
        return (self.seer_run.extras or {}).get(CAP_EXHAUSTED_EXTRA, {}).get(REPO_NAME)

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_assigns_and_comments(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result()

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        _, pr_number = mock_actions.update_issue.call_args[0]
        assert pr_number == str(PR_NUMBER)
        assert mock_actions.update_issue.call_args[1]["assignees"] == ["octocat"]
        _, pr_number, body = mock_actions.create_pull_request_comment.call_args[0]
        assert pr_number == str(PR_NUMBER)
        assert "@octocat" in body
        assert "automated fix attempts" in body
        marker = self._marker()
        assert marker is not None
        assert marker["assignees"] == ["octocat"]
        assert marker["commented"] is True
        assert marker["head_sha"] == HEAD_SHA
        assert marker["recorded_at"]
        assert "preexisting" not in marker

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    def test_noop_when_flag_disabled(self, mock_actions: MagicMock, mock_cap: MagicMock) -> None:
        assign_user_for_exhausted_cap(_event(), self._resolved())

        # The flag gate runs before everything else so disabled orgs cost nothing.
        mock_cap.assert_not_called()
        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()
        assert self._marker() is None

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    def test_skips_stale_head(self, mock_actions: MagicMock, _mock_cap: MagicMock) -> None:
        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved(commit_sha="newer-sha"))

        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()
        assert self._marker() is None

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    def test_noop_when_cap_not_reached(self, mock_actions: MagicMock, mock_cap: MagicMock) -> None:
        mock_cap.return_value = False

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()
        assert self._marker() is None

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    def test_skips_night_shift_run_without_user(
        self, mock_actions: MagicMock, _mock_cap: MagicMock
    ) -> None:
        self.seer_run.update(user_id=None)

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    def test_skips_when_no_seer_run_row(
        self, mock_actions: MagicMock, _mock_cap: MagicMock
    ) -> None:
        self.seer_run.delete()

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    def test_skips_when_already_handed_off(
        self, mock_actions: MagicMock, _mock_cap: MagicMock
    ) -> None:
        self.seer_run.update(
            extras={
                CAP_EXHAUSTED_EXTRA: {
                    REPO_NAME: {
                        "recorded_at": "2024-01-01T00:00:00+00:00",
                        "head_sha": HEAD_SHA,
                        "assignees": ["octocat"],
                        "commented": True,
                    }
                }
            }
        )

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        # The marker pre-check must short-circuit before any SCM work.
        mock_actions.get_pull_request.assert_not_called()
        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_rehandles_when_cap_exhausted_on_new_head(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        # A previous handoff on an older head; the user then sent Seer back
        # with guidance and the new streak exhausted the cap again.
        self.seer_run.update(
            extras={
                CAP_EXHAUSTED_EXTRA: {
                    REPO_NAME: {
                        "recorded_at": "2024-01-01T00:00:00+00:00",
                        "head_sha": "older-sha",
                        "assignees": ["octocat"],
                        "commented": True,
                    }
                }
            }
        )
        mock_actions.get_pull_request.return_value = _pull_request_result(
            assignees=[{"login": "octocat"}]
        )

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        # The user must learn the run went quiet again: a fresh comment, no
        # re-assignment (they still are), marker moved to the new head.
        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_called_once()
        marker = self._marker()
        assert marker is not None
        assert marker["head_sha"] == HEAD_SHA

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value=None)
    def test_skips_when_no_github_login(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()
        assert self._marker() is None

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_skips_when_pr_not_open(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result(
            state="closed", merged=True
        )

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()
        assert self._marker() is None

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_merges_existing_assignees(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result(
            assignees=[{"login": "alice"}]
        )

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        # The issues PATCH replaces assignees wholesale, so the existing
        # assignee must be preserved.
        assert mock_actions.update_issue.call_args[1]["assignees"] == ["alice", "octocat"]

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_comments_without_assigning_when_already_assigned(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result(
            assignees=[{"login": "Octocat"}]
        )

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_called_once()
        marker = self._marker()
        assert marker is not None
        assert marker["assignees"] == ["octocat"]
        assert marker["commented"] is True
        assert marker["preexisting"] is True

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_assign_failure_still_comments(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result()
        mock_actions.update_issue.side_effect = Exception("boom")

        with self.feature(FLAG), patch(f"{CAP_EXHAUSTED_PATH}.metrics") as mock_metrics:
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.create_pull_request_comment.assert_called_once()
        marker = self._marker()
        assert marker is not None
        assert marker["assignees"] == []
        assert marker["commented"] is True
        mock_metrics.incr.assert_any_call(
            "autofix.pr_iteration.cap_exhausted.failed", tags={"reason": "assign_failed"}
        )

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_comment_failure_still_records_assignment(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result()
        mock_actions.create_pull_request_comment.side_effect = Exception("boom")

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.update_issue.assert_called_once()
        marker = self._marker()
        assert marker is not None
        assert marker["assignees"] == ["octocat"]
        assert marker["commented"] is False

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_comment_failure_with_preexisting_assignment_retries(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result(
            assignees=[{"login": "octocat"}]
        )
        mock_actions.create_pull_request_comment.side_effect = Exception("boom")

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        # With the user already assigned, the comment is the only thing we add;
        # if it fails, nothing new reached them, so the next suite must retry.
        mock_actions.update_issue.assert_not_called()
        assert self._marker() is None

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_both_failures_leave_marker_unset(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result()
        mock_actions.update_issue.side_effect = Exception("boom")
        mock_actions.create_pull_request_comment.side_effect = Exception("boom")

        with self.feature(FLAG):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        # Nothing reached the human, so the next failing suite must retry.
        assert self._marker() is None

    @patch(f"{CAP_EXHAUSTED_PATH}.scm_actions")
    @patch("sentry.scm.factory.new", return_value=MagicMock())
    @patch(f"{CAP_EXHAUSTED_PATH}.get_github_username_for_user", return_value="octocat")
    @patch(f"{CAP_EXHAUSTED_PATH}.GetPullRequestProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.UpdateIssueProtocol", object)
    @patch(f"{CAP_EXHAUSTED_PATH}.CreatePullRequestCommentProtocol", object)
    def test_skips_when_run_deleted_before_marker_write(
        self,
        _mock_username: MagicMock,
        _mock_scm: MagicMock,
        mock_actions: MagicMock,
        _mock_cap: MagicMock,
    ) -> None:
        mock_actions.get_pull_request.return_value = _pull_request_result()

        with (
            self.feature(FLAG),
            patch.object(SeerRun, "refresh_from_db", side_effect=SeerRun.DoesNotExist),
        ):
            assign_user_for_exhausted_cap(_event(), self._resolved())

        mock_actions.update_issue.assert_not_called()
        mock_actions.create_pull_request_comment.assert_not_called()
