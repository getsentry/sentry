from unittest.mock import MagicMock, patch

from scm.types import CreatePullRequestCommentProtocol

from sentry.seer.autofix.pr_iteration.nudge import (
    NUDGE_EXTRA,
    NudgeKind,
    nudge_comment_body,
    post_not_requested_nudge,
    queue_not_requested_nudge,
)
from sentry.seer.autofix.pr_iteration.pause import PAUSED_EXTRA
from sentry.seer.models.run import SeerRun
from sentry.seer.webhooks import sentry_command
from sentry.testutils.cases import TestCase

MODULE = "sentry.seer.autofix.pr_iteration.nudge"
TASK_DELAY = "sentry.tasks.seer.pr_iteration.nudge_not_requested_feedback.delay"

RUN_ID = 67890
REPOSITORY_ID = 123
PR_NUMBER = 7


class NudgeCommentBodyTest(TestCase):
    def test_ci(self) -> None:
        body = nudge_comment_body(self.organization, NudgeKind.CI)

        assert "didn't fix the failing CI" in body
        assert "`@sentry fix CI`" in body
        assert f"/settings/{self.organization.slug}/seer/projects/" in body

    def test_review(self) -> None:
        body = nudge_comment_body(self.organization, NudgeKind.REVIEW)

        assert "didn't address the latest review" in body
        assert "`@sentry address the latest review`" in body
        assert f"/settings/{self.organization.slug}/seer/projects/" in body

    def test_is_two_lines(self) -> None:
        body = nudge_comment_body(self.organization, NudgeKind.CI)

        assert len(body.split("\n\n")) == 2
        assert "\n" not in body.replace("\n\n", "")

    def test_never_reads_as_a_sentry_command(self) -> None:
        # Seer posts this comment itself; it must not trigger an iteration.
        assert sentry_command(nudge_comment_body(self.organization, NudgeKind.CI)) is None
        assert sentry_command(nudge_comment_body(self.organization, NudgeKind.REVIEW)) is None


class QueueNotRequestedNudgeTest(TestCase):
    def _queue(self) -> None:
        queue_not_requested_nudge(
            run_id=RUN_ID,
            organization_id=self.organization.id,
            repository_id=REPOSITORY_ID,
            pr_number=PR_NUMBER,
            kind=NudgeKind.CI,
        )

    @patch(TASK_DELAY)
    def test_queues(self, mock_delay: MagicMock) -> None:
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)

        self._queue()

        mock_delay.assert_called_once_with(
            run_id=RUN_ID,
            organization_id=self.organization.id,
            repository_id=REPOSITORY_ID,
            pr_number=PR_NUMBER,
            kind="ci",
        )

    @patch(TASK_DELAY)
    def test_skips_without_a_seer_run(self, mock_delay: MagicMock) -> None:
        self._queue()

        mock_delay.assert_not_called()

    @patch(TASK_DELAY)
    def test_skips_when_already_nudged(self, mock_delay: MagicMock) -> None:
        self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=RUN_ID,
            extras={NUDGE_EXTRA: {"kind": "review"}},
        )

        self._queue()

        mock_delay.assert_not_called()

    @patch(TASK_DELAY)
    def test_skips_when_paused(self, mock_delay: MagicMock) -> None:
        self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=RUN_ID,
            extras={PAUSED_EXTRA: {"reason": "user_stop"}},
        )

        self._queue()

        mock_delay.assert_not_called()


class PostNotRequestedNudgeTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        scm_patcher = patch(
            f"{MODULE}.make_scm", return_value=MagicMock(spec=CreatePullRequestCommentProtocol)
        )
        self.mock_make_scm = scm_patcher.start()
        self.addCleanup(scm_patcher.stop)
        actions_patcher = patch(f"{MODULE}.scm_actions")
        self.mock_actions = actions_patcher.start()
        self.addCleanup(actions_patcher.stop)

    def _post(self, kind: NudgeKind = NudgeKind.CI) -> None:
        post_not_requested_nudge(
            organization=self.organization,
            run_id=RUN_ID,
            repository_id=REPOSITORY_ID,
            pr_number=PR_NUMBER,
            kind=kind,
        )

    def test_posts_and_marks(self) -> None:
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)

        self._post(NudgeKind.REVIEW)

        assert self.mock_make_scm.call_args[0] == (self.organization.id, REPOSITORY_ID)
        self.mock_actions.create_pull_request_comment.assert_called_once()
        _, pr_number, body = self.mock_actions.create_pull_request_comment.call_args[0]
        assert pr_number == str(PR_NUMBER)
        assert body == nudge_comment_body(self.organization, NudgeKind.REVIEW)
        seer_run.refresh_from_db()
        marker = seer_run.extras[NUDGE_EXTRA]
        assert marker["kind"] == "review"
        assert marker["pr_number"] == PR_NUMBER

    def test_posts_once_per_run(self) -> None:
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)

        self._post(NudgeKind.CI)
        self._post(NudgeKind.REVIEW)

        self.mock_actions.create_pull_request_comment.assert_called_once()

    def test_skips_when_paused(self) -> None:
        seer_run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=RUN_ID,
            extras={PAUSED_EXTRA: {"reason": "user_stop"}},
        )

        self._post()

        self.mock_actions.create_pull_request_comment.assert_not_called()
        seer_run.refresh_from_db()
        assert NUDGE_EXTRA not in seer_run.extras

    def test_skips_without_a_seer_run(self) -> None:
        self._post()

        self.mock_actions.create_pull_request_comment.assert_not_called()

    def test_skips_when_the_run_is_deleted_before_the_claim(self) -> None:
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)
        # A queryset delete keeps ``seer_run.id``, as a stale lookup would.
        SeerRun.objects.filter(id=seer_run.id).delete()

        with patch(f"{MODULE}.get_seer_run", return_value=seer_run):
            self._post()

        self.mock_make_scm.assert_not_called()
        self.mock_actions.create_pull_request_comment.assert_not_called()

    def test_failed_post_is_not_retried(self) -> None:
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)
        self.mock_actions.create_pull_request_comment.side_effect = Exception("boom")

        self._post()
        self._post()

        # Claimed before posting: a failure stays quiet rather than risk two comments.
        self.mock_actions.create_pull_request_comment.assert_called_once()
        seer_run.refresh_from_db()
        assert NUDGE_EXTRA in seer_run.extras

    def test_unsupported_provider_does_not_post(self) -> None:
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)
        self.mock_make_scm.return_value = object()

        self._post()

        self.mock_actions.create_pull_request_comment.assert_not_called()
