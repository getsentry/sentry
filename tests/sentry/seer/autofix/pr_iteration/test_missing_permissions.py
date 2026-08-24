from unittest.mock import MagicMock, patch

from sentry.integrations.services.integration import RpcIntegration
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.github_perms import MissingGithubPermissions
from sentry.seer.autofix.pr_iteration.missing_permissions import (
    _scopes_tag,
    block_iteration_for_missing_permissions,
    get_missing_permissions_marker,
)
from sentry.testutils.cases import TestCase

REPO_NAME = "getsentry/sentry"
OTHER_REPO_NAME = "getsentry/seer"
RUN_ID = 1


def _perms(
    integration_id: int,
    repository_id: int = 123,
    missing_scopes: list[str] | None = None,
) -> MissingGithubPermissions:
    return MissingGithubPermissions(
        integration=RpcIntegration(
            id=integration_id,
            provider="github",
            external_id=str(integration_id),
            name="octocat",
            metadata={},
            status=0,
        ),
        missing_scopes=missing_scopes if missing_scopes is not None else ["contents"],
        repository_id=repository_id,
    )


def _state(**pr_numbers: int | None) -> SeerRunState:
    return SeerRunState(
        run_id=RUN_ID,
        blocks=[],
        status="completed",
        updated_at="2023-07-18T12:00:00Z",
        repo_pr_states={
            repo_name.replace("__", "/"): RepoPRState(
                repo_name=repo_name.replace("__", "/"),
                pr_number=pr_number,
                pr_id=4242 if pr_number is not None else None,
            )
            for repo_name, pr_number in pr_numbers.items()
        },
    )


@patch("sentry.seer.autofix.pr_iteration.missing_permissions.get_missing_permissions_by_repo")
class BlockIterationForMissingPermissionsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _stub_client(self) -> MagicMock:
        client = MagicMock()
        patcher = patch.object(
            RpcIntegration,
            "get_installation",
            return_value=MagicMock(get_client=MagicMock(return_value=client)),
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        return client

    def _run(self, state: SeerRunState) -> bool:
        return block_iteration_for_missing_permissions(
            organization=self.organization, run_id=RUN_ID, state=state
        )

    def test_allows_iteration_when_nothing_missing(self, mock_get_perms) -> None:
        mock_get_perms.return_value = {}

        assert self._run(_state(getsentry__sentry=7)) is False

    def test_only_checks_repos_with_a_pr(self, mock_get_perms) -> None:
        mock_get_perms.return_value = {}

        self._run(_state(getsentry__sentry=7, getsentry__seer=None))

        assert mock_get_perms.call_args[0][1] == [REPO_NAME]

    def test_allows_iteration_when_the_check_raises(self, mock_get_perms) -> None:
        mock_get_perms.side_effect = ValueError("boom")

        assert self._run(_state(getsentry__sentry=7)) is False

    def test_blocks_and_comments_once(self, mock_get_perms) -> None:
        perms = _perms(42)
        mock_get_perms.return_value = {REPO_NAME: perms}
        client = self._stub_client()

        assert self._run(_state(getsentry__sentry=7)) is True

        client.create_comment.assert_called_once()
        repo_name, pr_number, payload = client.create_comment.call_args[0]
        assert repo_name == REPO_NAME
        assert pr_number == "7"
        assert "additional GitHub permissions" in payload["body"]
        assert "/settings/installations/42/permissions/update" in payload["body"]

        self.seer_run.refresh_from_db()
        marker = get_missing_permissions_marker(self.seer_run, REPO_NAME)
        assert marker is not None
        assert marker["missing_scopes"] == ["contents"]
        assert marker["pr_id"] == 4242

        # A second failing suite on the same run still blocks, silently.
        assert self._run(_state(getsentry__sentry=7)) is True
        client.create_comment.assert_called_once()

    def test_comments_per_repo(self, mock_get_perms) -> None:
        perms = _perms(42)
        mock_get_perms.return_value = {REPO_NAME: perms, OTHER_REPO_NAME: perms}
        client = self._stub_client()

        assert self._run(_state(getsentry__sentry=7, getsentry__seer=9)) is True

        assert client.create_comment.call_count == 2
        self.seer_run.refresh_from_db()
        assert get_missing_permissions_marker(self.seer_run, REPO_NAME) is not None
        assert get_missing_permissions_marker(self.seer_run, OTHER_REPO_NAME) is not None

    def test_no_marker_when_the_comment_fails(self, mock_get_perms) -> None:
        perms = _perms(42)
        mock_get_perms.return_value = {REPO_NAME: perms}
        client = self._stub_client()
        client.create_comment.side_effect = Exception("nope")

        assert self._run(_state(getsentry__sentry=7)) is True

        self.seer_run.refresh_from_db()
        assert get_missing_permissions_marker(self.seer_run, REPO_NAME) is None

    def test_blocks_without_commenting_when_no_seer_run(self, mock_get_perms) -> None:
        self.seer_run.delete()
        perms = _perms(42)
        mock_get_perms.return_value = {REPO_NAME: perms}
        client = self._stub_client()

        assert self._run(_state(getsentry__sentry=7)) is True

        client.create_comment.assert_not_called()


class ScopesTagTest(TestCase):
    def test_sorts_and_dedupes_for_a_stable_series(self) -> None:
        assert _scopes_tag(["pull_requests", "contents"]) == "contents-pull_requests"
        assert _scopes_tag(["contents", "pull_requests"]) == "contents-pull_requests"
        assert _scopes_tag(["contents", "contents"]) == "contents"

    def test_avoids_the_dogstatsd_tag_separator(self) -> None:
        # dogstatsd joins the tag list with "," on the wire, so a comma in a
        # value would split into bogus tags.
        assert "," not in _scopes_tag(["contents", "checks", "actions"])

    def test_empty(self) -> None:
        assert _scopes_tag([]) == "none"


@patch("sentry.seer.autofix.pr_iteration.missing_permissions.metrics.incr")
@patch("sentry.seer.autofix.pr_iteration.missing_permissions.get_missing_permissions_by_repo")
class MissingScopesMetricTagTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def test_blocked_tag_unions_scopes_across_repos(self, mock_get_perms, mock_incr) -> None:
        mock_get_perms.return_value = {
            REPO_NAME: _perms(1, missing_scopes=["pull_requests", "contents"]),
            OTHER_REPO_NAME: _perms(2, missing_scopes=["contents", "checks"]),
        }
        patcher = patch.object(RpcIntegration, "get_installation")
        patcher.start()
        self.addCleanup(patcher.stop)

        block_iteration_for_missing_permissions(
            organization=self.organization,
            run_id=RUN_ID,
            state=_state(getsentry__sentry=7, getsentry__seer=9),
        )

        blocked = [c for c in mock_incr.call_args_list if c[0][0].endswith(".blocked")]
        assert len(blocked) == 1
        assert blocked[0][1]["tags"] == {"missing_scopes": "checks-contents-pull_requests"}

    def test_commented_tag_is_per_repo(self, mock_get_perms, mock_incr) -> None:
        mock_get_perms.return_value = {
            REPO_NAME: _perms(1, missing_scopes=["pull_requests", "contents"])
        }
        patcher = patch.object(RpcIntegration, "get_installation")
        patcher.start()
        self.addCleanup(patcher.stop)

        block_iteration_for_missing_permissions(
            organization=self.organization, run_id=RUN_ID, state=_state(getsentry__sentry=7)
        )

        commented = [c for c in mock_incr.call_args_list if c[0][0].endswith(".commented")]
        assert len(commented) == 1
        assert commented[0][1]["tags"] == {"missing_scopes": "contents-pull_requests"}
