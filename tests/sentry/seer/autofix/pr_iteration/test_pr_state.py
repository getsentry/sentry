from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.pr_state import iteration_prs_any_external_head
from sentry.testutils.cases import TestCase

PR_STATE_PATH = "sentry.seer.autofix.pr_iteration.pr_state"


class _ScmStub:
    def get_pull_request(self, *args, **kwargs): ...


class IterationPrsAnyForeignHeadTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name="owner/repo"
        )

    def _state(self, commit_sha: str | None = "seer-sha") -> SeerRunState:
        return SeerRunState(
            run_id=1,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_number=7, commit_sha=commit_sha
                )
            },
        )

    def _check(self, state: SeerRunState, head_sha: str | None) -> bool:
        with (
            patch(f"{PR_STATE_PATH}.make_scm", return_value=MagicMock(spec=_ScmStub)),
            patch(f"{PR_STATE_PATH}.scm_actions.get_pull_request") as mock_get,
        ):
            mock_get.return_value = {"data": {"state": "open", "head": {"sha": head_sha}}}
            return iteration_prs_any_external_head(self.organization.id, state)

    def test_head_seer_pushed(self) -> None:
        assert self._check(self._state(), "seer-sha") is False

    def test_head_someone_else_pushed(self) -> None:
        assert self._check(self._state(), "human-sha") is True

    def test_unknown_heads_are_passed_over(self) -> None:
        assert self._check(self._state(), None) is False
        assert self._check(self._state(commit_sha=None), "human-sha") is False

    def test_unreadable_pr_is_passed_over(self) -> None:
        with (
            patch(f"{PR_STATE_PATH}.make_scm", return_value=MagicMock(spec=_ScmStub)),
            patch(f"{PR_STATE_PATH}.scm_actions.get_pull_request", side_effect=RuntimeError),
        ):
            assert iteration_prs_any_external_head(self.organization.id, self._state()) is False
