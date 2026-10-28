from typing import Any
from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.pr_state import iteration_prs_any_external_head
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

PR_STATE_PATH = "sentry.seer.autofix.pr_iteration.pr_state"


class _ScmStub:
    def get_pull_request(self, *args, **kwargs): ...

    def get_commit(self, *args, **kwargs): ...


APP_LOGIN = "seer-dev[bot]"


def _commit(author_login: str, verified: bool) -> dict[str, Any]:
    return {
        "data": {"author_login": author_login},
        "raw": {"data": {"commit": {"verification": {"verified": verified}}}},
    }


class IterationPrsAnyForeignHeadTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name="owner/repo"
        )

    def _state(self, commit_sha: str | None = "seer-sha", group_id: int | None = 1) -> SeerRunState:
        return SeerRunState(
            run_id=1,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            metadata={"group_id": group_id} if group_id is not None else {},
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_number=7, commit_sha=commit_sha
                )
            },
        )

    def _check(
        self, state: SeerRunState, head_sha: str | None, commit: dict[str, Any] | None = None
    ) -> bool:
        with (
            override_options({"github-app.name": "Seer Dev"}),
            patch(f"{PR_STATE_PATH}.make_scm", return_value=MagicMock(spec=_ScmStub)),
            patch(f"{PR_STATE_PATH}.scm_actions.get_pull_request") as mock_get,
            patch(f"{PR_STATE_PATH}.scm_actions.get_commit", return_value=commit),
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

    def test_ad_hoc_head_naming_our_app_without_signature_is_external(self) -> None:
        state = self._state(group_id=None)
        assert self._check(state, "spoofed-sha", _commit(APP_LOGIN, verified=False)) is True
        assert self._check(state, "human-sha", _commit("someone", verified=True)) is True

    def test_autofix_head_committed_by_our_app_is_still_external(self) -> None:
        state = self._state()
        assert self._check(state, "other-sha", _commit(APP_LOGIN, verified=True)) is True
