import logging
from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.services.integration import RpcIntegration
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.github_perms import MissingGithubPermissions
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.missing_permissions import (
    MISSING_PERMISSIONS_EXTRA,
    _scopes_tag,
    block_iteration_for_missing_permissions,
    get_missing_permissions_marker,
    post_missing_permissions_comment,
)
from sentry.seer.models.run import SeerRun
from sentry.testutils.cases import TestCase
from sentry.utils.locking import UnableToAcquireLock

MODULE = "sentry.seer.autofix.pr_iteration.missing_permissions"
REPO_NAME = "getsentry/sentry"
OTHER_REPO_NAME = "getsentry/seer"
RUN_ID = 1
INTEGRATION_ID = 42


def _perms(
    integration_id: int = INTEGRATION_ID,
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


def _log_ctx(state: SeerRunState) -> PrIterationLogContext:
    return PrIterationLogContext.for_run(
        logging.getLogger(MODULE), state, organization_id=1, group_id=None
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


@patch("sentry.tasks.seer.pr_iteration.comment_on_missing_permissions.delay")
@patch(f"{MODULE}.get_missing_permissions_by_repo")
class BlockIterationForMissingPermissionsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _run(self, state: SeerRunState) -> bool:
        return block_iteration_for_missing_permissions(
            organization=self.organization,
            run_id=RUN_ID,
            state=state,
            log_ctx=_log_ctx(state),
        )

    def test_allows_iteration_when_nothing_missing(self, mock_get_perms, mock_delay) -> None:
        mock_get_perms.return_value = {}

        assert self._run(_state(getsentry__sentry=7)) is False
        mock_delay.assert_not_called()

    def test_only_checks_repos_with_a_pr(self, mock_get_perms, _mock_delay) -> None:
        mock_get_perms.return_value = {}

        self._run(_state(getsentry__sentry=7, getsentry__seer=None))

        assert mock_get_perms.call_args[0][1] == [REPO_NAME]

    def test_allows_iteration_when_the_check_raises(self, mock_get_perms, mock_delay) -> None:
        mock_get_perms.side_effect = ValueError("boom")

        assert self._run(_state(getsentry__sentry=7)) is False
        mock_delay.assert_not_called()

    def test_blocks_and_queues_a_comment(self, mock_get_perms, mock_delay) -> None:
        mock_get_perms.return_value = {REPO_NAME: _perms()}

        assert self._run(_state(getsentry__sentry=7)) is True

        mock_delay.assert_called_once_with(
            run_id=RUN_ID,
            organization_id=self.organization.id,
            repo_name=REPO_NAME,
            pr_number=7,
            pr_id=4242,
            integration_id=INTEGRATION_ID,
        )

    def test_queues_per_repo(self, mock_get_perms, mock_delay) -> None:
        mock_get_perms.return_value = {REPO_NAME: _perms(), OTHER_REPO_NAME: _perms()}

        assert self._run(_state(getsentry__sentry=7, getsentry__seer=9)) is True

        assert mock_delay.call_count == 2
        assert {call.kwargs["repo_name"] for call in mock_delay.call_args_list} == {
            REPO_NAME,
            OTHER_REPO_NAME,
        }

    def test_skips_the_queue_once_the_marker_is_set(self, mock_get_perms, mock_delay) -> None:
        mock_get_perms.return_value = {REPO_NAME: _perms()}
        self.seer_run.update(
            extras={MISSING_PERMISSIONS_EXTRA: {REPO_NAME: {"missing_scopes": ["contents"]}}}
        )

        assert self._run(_state(getsentry__sentry=7)) is True
        mock_delay.assert_not_called()

    def test_blocks_without_queueing_when_no_seer_run(self, mock_get_perms, mock_delay) -> None:
        self.seer_run.delete()
        mock_get_perms.return_value = {REPO_NAME: _perms()}

        assert self._run(_state(getsentry__sentry=7)) is True
        mock_delay.assert_not_called()


@patch(f"{MODULE}.get_github_missing_permissions")
class PostMissingPermissionsCommentTest(TestCase):
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

    def _post(self) -> None:
        post_missing_permissions_comment(
            organization=self.organization,
            run_id=RUN_ID,
            repo_name=REPO_NAME,
            pr_number=7,
            pr_id=4242,
            integration_id=INTEGRATION_ID,
            log_ctx=_log_ctx(_state(getsentry__sentry=7)),
        )

    def test_comments_and_marks(self, mock_get_perms) -> None:
        mock_get_perms.return_value = _perms()
        client = self._stub_client()

        self._post()

        client.create_comment.assert_called_once()
        repo_name, pr_number, payload = client.create_comment.call_args[0]
        assert repo_name == REPO_NAME
        assert pr_number == "7"
        assert "additional GitHub permissions" in payload["body"]
        assert f"/settings/installations/{INTEGRATION_ID}/permissions/update" in payload["body"]

        self.seer_run.refresh_from_db()
        marker = get_missing_permissions_marker(self.seer_run, REPO_NAME)
        assert marker is not None
        assert marker["missing_scopes"] == ["contents"]
        assert marker["pr_id"] == 4242

    def test_stays_silent_once_marked(self, mock_get_perms) -> None:
        mock_get_perms.return_value = _perms()
        client = self._stub_client()
        self.seer_run.update(
            extras={MISSING_PERMISSIONS_EXTRA: {REPO_NAME: {"missing_scopes": ["contents"]}}}
        )

        self._post()

        client.create_comment.assert_not_called()

    def test_stays_silent_when_the_permissions_were_accepted(self, mock_get_perms) -> None:
        mock_get_perms.return_value = _perms(missing_scopes=[])
        client = self._stub_client()

        self._post()

        client.create_comment.assert_not_called()
        self.seer_run.refresh_from_db()
        assert get_missing_permissions_marker(self.seer_run, REPO_NAME) is None

    def test_stays_silent_when_the_integration_is_gone(self, mock_get_perms) -> None:
        mock_get_perms.return_value = None
        client = self._stub_client()

        self._post()

        client.create_comment.assert_not_called()

    def test_no_second_comment_when_a_racing_task_marks_first(self, mock_get_perms) -> None:
        mock_get_perms.return_value = _perms()
        client = self._stub_client()

        def _mark(run: SeerRun) -> None:
            run.extras = {MISSING_PERMISSIONS_EXTRA: {REPO_NAME: {"missing_scopes": ["contents"]}}}

        with patch.object(SeerRun, "refresh_from_db", autospec=True, side_effect=_mark):
            self._post()

        client.create_comment.assert_not_called()

    def test_stays_silent_when_run_deleted_before_marker_write(self, mock_get_perms) -> None:
        mock_get_perms.return_value = _perms()
        client = self._stub_client()

        with patch.object(SeerRun, "refresh_from_db", side_effect=SeerRun.DoesNotExist):
            self._post()

        client.create_comment.assert_not_called()

    def test_no_marker_when_the_comment_fails(self, mock_get_perms) -> None:
        mock_get_perms.return_value = _perms()
        client = self._stub_client()
        client.create_comment.side_effect = Exception("nope")

        self._post()

        self.seer_run.refresh_from_db()
        assert get_missing_permissions_marker(self.seer_run, REPO_NAME) is None

    def test_raises_for_the_task_to_retry_when_the_lock_is_held(self, mock_get_perms) -> None:
        mock_get_perms.return_value = _perms()
        client = self._stub_client()
        lock = MagicMock()
        lock.acquire.side_effect = UnableToAcquireLock()

        with patch(f"{MODULE}.locks.get", return_value=lock):
            with pytest.raises(UnableToAcquireLock):
                self._post()

        client.create_comment.assert_not_called()

    def test_stays_silent_when_no_seer_run(self, mock_get_perms) -> None:
        self.seer_run.delete()
        mock_get_perms.return_value = _perms()
        client = self._stub_client()

        self._post()

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


@patch(f"{MODULE}.metrics.incr")
@patch("sentry.tasks.seer.pr_iteration.comment_on_missing_permissions.delay")
@patch(f"{MODULE}.get_missing_permissions_by_repo")
class MissingPermissionsMetricsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def test_blocked_tag_unions_scopes_across_repos(
        self, mock_get_perms, _mock_delay, mock_incr
    ) -> None:
        mock_get_perms.return_value = {
            REPO_NAME: _perms(1, missing_scopes=["pull_requests", "contents"]),
            OTHER_REPO_NAME: _perms(2, missing_scopes=["contents", "checks"]),
        }

        state = _state(getsentry__sentry=7, getsentry__seer=9)
        block_iteration_for_missing_permissions(
            organization=self.organization,
            run_id=RUN_ID,
            state=state,
            log_ctx=_log_ctx(state),
        )

        blocked = [c for c in mock_incr.call_args_list if c[0][0].endswith(".blocked")]
        assert len(blocked) == 1
        assert blocked[0][1]["tags"] == {"missing_scopes": "checks-contents-pull_requests"}


@patch(f"{MODULE}.metrics.incr")
@patch(f"{MODULE}.get_github_missing_permissions")
class CommentedMetricTagTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def test_commented_tag_is_per_repo(self, mock_get_perms, mock_incr) -> None:
        mock_get_perms.return_value = _perms(missing_scopes=["pull_requests", "contents"])
        patcher = patch.object(RpcIntegration, "get_installation")
        patcher.start()
        self.addCleanup(patcher.stop)

        post_missing_permissions_comment(
            organization=self.organization,
            run_id=RUN_ID,
            repo_name=REPO_NAME,
            pr_number=7,
            pr_id=4242,
            integration_id=INTEGRATION_ID,
            log_ctx=_log_ctx(_state(getsentry__sentry=7)),
        )

        commented = [c for c in mock_incr.call_args_list if c[0][0].endswith(".commented")]
        assert len(commented) == 1
        assert commented[0][1]["tags"] == {"missing_scopes": "contents-pull_requests"}
