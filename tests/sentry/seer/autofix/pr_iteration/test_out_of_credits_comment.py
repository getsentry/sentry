from typing import Any
from unittest.mock import MagicMock, patch

from scm.types import CreatePullRequestCommentProtocol

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.out_of_credits import OUT_OF_CREDITS_EXTRA
from sentry.seer.autofix.pr_iteration.out_of_credits_comment import (
    OUT_OF_CREDITS_COMMENT_EXTRA,
    clear_out_of_credits_comment,
    out_of_credits_comment_body,
    post_out_of_credits_comment,
    queue_out_of_credits_comment,
)
from sentry.seer.autofix.pr_iteration.pause import PAUSED_EXTRA
from sentry.seer.models.run import SeerRun
from sentry.seer.webhooks import sentry_command
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options

MODULE = "sentry.seer.autofix.pr_iteration.out_of_credits_comment"
TASK_DELAY = "sentry.tasks.seer.pr_iteration.comment_on_out_of_credits.delay"

RUN_ID = 67890
REPO = "owner/repo"
OTHER_REPO = "owner/other"
PR_NUMBER = 7
STOPPED = {OUT_OF_CREDITS_EXTRA: {"stranded_action": None, "denial_reason": None}}


class _ScmStub:
    """Spec for an SCM that can read PRs as well as comment on them."""

    def get_pull_request(self, *args: Any, **kwargs: Any) -> Any: ...

    def create_pull_request_comment(self, *args: Any, **kwargs: Any) -> Any: ...


class OutOfCreditsCommentBodyTest(TestCase):
    # The exact markdown posted on the PR, with SaaS (customer domain) links.
    @with_feature("system:multi-region")
    def test_out_of_credits(self) -> None:
        organization = self.create_organization(slug="acme")

        assert out_of_credits_comment_body(organization, "not_enough_credits") == (
            "Seer stopped working on this pull request because your organization does not have "
            "enough credits. Seer continues the next time it iterates on the pull request.\n\n"
            "Once credits are added, comment `@sentry <instructions>` to have Seer pick it back "
            "up now. Set up auto-reload in "
            "[billing settings](http://acme.testserver/settings/billing/overview/) "
            "to keep Seer running."
        )

    @with_feature("system:multi-region")
    def test_daily_limit(self) -> None:
        organization = self.create_organization(slug="acme")

        assert out_of_credits_comment_body(organization, "daily_cap_exceeded") == (
            "Seer stopped working on this pull request because your organization hit its daily "
            "usage limit. Seer continues the next time it iterates on the pull request.\n\n"
            "Once the limit resets or is raised, comment `@sentry <instructions>` to have Seer "
            "pick it back up now. You can change the limit in "
            "[billing settings](http://acme.testserver/settings/billing/overview/)."
        )

    def test_links_to_billing_without_customer_domains(self) -> None:
        body = out_of_credits_comment_body(self.organization, "daily_cap_exceeded")

        assert f"(http://testserver/settings/{self.organization.slug}/billing/overview/)" in body

    def test_an_unknown_reason_reads_as_out_of_credits(self) -> None:
        assert out_of_credits_comment_body(self.organization, None) == (
            out_of_credits_comment_body(self.organization, "not_enough_credits")
        )

    def test_never_reads_as_a_sentry_command(self) -> None:
        # Seer posts this comment itself; it must not trigger an iteration.
        body = out_of_credits_comment_body(self.organization, "not_enough_credits")
        assert sentry_command(body) is None
        body = out_of_credits_comment_body(self.organization, "daily_cap_exceeded")
        assert sentry_command(body) is None


class QueueOutOfCreditsCommentTest(TestCase):
    def _state(self, **pr_numbers: int | None) -> SeerRunState:
        state = SeerRunState(
            run_id=RUN_ID, blocks=[], status="completed", updated_at="2024-01-01T00:00:00Z"
        )
        state.repo_pr_states = {
            repo: RepoPRState(repo_name=repo, pr_number=pr_number)
            for repo, pr_number in pr_numbers.items()
        }
        return state

    def _queue(self, state: SeerRunState) -> None:
        queue_out_of_credits_comment(
            run_id=RUN_ID,
            organization_id=self.organization.id,
            state=state,
            denial_reason="daily_cap_exceeded",
        )

    @patch(TASK_DELAY)
    def test_queues_for_each_open_pr(self, mock_delay: MagicMock) -> None:
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)

        self._queue(self._state(repo=PR_NUMBER, other=None))

        mock_delay.assert_called_once_with(
            run_id=RUN_ID,
            organization_id=self.organization.id,
            pr_numbers_by_repo={"repo": PR_NUMBER},
            denial_reason="daily_cap_exceeded",
        )

    @patch(TASK_DELAY, side_effect=Exception("broker down"))
    def test_an_enqueue_failure_does_not_raise(self, mock_delay: MagicMock) -> None:
        # The stop is already recorded; only the comment is lost.
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)

        self._queue(self._state(repo=PR_NUMBER))

        mock_delay.assert_called_once()

    @patch(TASK_DELAY)
    @override_options({"autofix.pr-iteration.out-of-credits-comment.enabled": False})
    def test_skips_when_turned_off(self, mock_delay: MagicMock) -> None:
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)

        self._queue(self._state(repo=PR_NUMBER))

        mock_delay.assert_not_called()

    @patch(TASK_DELAY)
    def test_skips_without_a_pr(self, mock_delay: MagicMock) -> None:
        self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)

        self._queue(self._state(repo=None))

        mock_delay.assert_not_called()

    @patch(TASK_DELAY)
    def test_skips_without_a_seer_run(self, mock_delay: MagicMock) -> None:
        self._queue(self._state(repo=PR_NUMBER))

        mock_delay.assert_not_called()

    @patch(TASK_DELAY)
    def test_skips_when_the_stop_already_has_a_comment(self, mock_delay: MagicMock) -> None:
        self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=RUN_ID,
            extras={OUT_OF_CREDITS_COMMENT_EXTRA: {"denial_reason": None}},
        )

        self._queue(self._state(repo=PR_NUMBER))

        mock_delay.assert_not_called()

    @patch(TASK_DELAY)
    def test_skips_when_paused(self, mock_delay: MagicMock) -> None:
        self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=RUN_ID,
            extras={PAUSED_EXTRA: {"reason": "user_stop"}},
        )

        self._queue(self._state(repo=PR_NUMBER))

        mock_delay.assert_not_called()


class PostOutOfCreditsCommentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, name=REPO, provider="integrations:github"
        )
        scm_patcher = patch(
            f"{MODULE}.make_scm", return_value=MagicMock(spec=CreatePullRequestCommentProtocol)
        )
        self.mock_make_scm = scm_patcher.start()
        self.addCleanup(scm_patcher.stop)
        actions_patcher = patch(f"{MODULE}.scm_actions")
        self.mock_actions = actions_patcher.start()
        self.addCleanup(actions_patcher.stop)

    def _stopped_run(self, extras: dict[str, Any] | None = None) -> SeerRun:
        return self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=RUN_ID,
            extras={**STOPPED, **(extras or {})},
        )

    def _post(
        self,
        pr_numbers_by_repo: dict[str, int] | None = None,
        denial_reason: str | None = "daily_cap_exceeded",
    ) -> None:
        post_out_of_credits_comment(
            organization=self.organization,
            run_id=RUN_ID,
            pr_numbers_by_repo={REPO: PR_NUMBER}
            if pr_numbers_by_repo is None
            else pr_numbers_by_repo,
            denial_reason=denial_reason,
        )

    def test_posts_and_marks(self) -> None:
        seer_run = self._stopped_run()

        self._post()

        assert self.mock_make_scm.call_args[0] == (self.organization.id, self.repo.id)
        self.mock_actions.create_pull_request_comment.assert_called_once()
        _, pr_number, body = self.mock_actions.create_pull_request_comment.call_args[0]
        assert pr_number == str(PR_NUMBER)
        assert body == out_of_credits_comment_body(self.organization, "daily_cap_exceeded")
        seer_run.refresh_from_db()
        assert seer_run.extras[OUT_OF_CREDITS_COMMENT_EXTRA]["denial_reason"] == (
            "daily_cap_exceeded"
        )

    def test_posts_once_per_credit_stop(self) -> None:
        self._stopped_run()

        self._post()
        self._post(denial_reason="not_enough_credits")

        self.mock_actions.create_pull_request_comment.assert_called_once()

    def test_posts_again_after_an_iteration_starts(self) -> None:
        self._stopped_run()

        self._post()
        clear_out_of_credits_comment(run_id=RUN_ID, organization_id=self.organization.id)
        self._post()

        assert self.mock_actions.create_pull_request_comment.call_count == 2

    def test_skips_a_repo_it_cannot_resolve(self) -> None:
        self._stopped_run()
        # Another org's repo with the same name is never used.
        self.create_repo(
            project=self.create_project(organization=self.create_organization()),
            name=OTHER_REPO,
            provider="integrations:github",
        )

        self._post({OTHER_REPO: 8, REPO: PR_NUMBER})

        self.mock_actions.create_pull_request_comment.assert_called_once()
        assert self.mock_make_scm.call_args[0] == (self.organization.id, self.repo.id)

    def test_skips_a_repo_name_shared_by_two_repos(self) -> None:
        self._stopped_run()
        # Refuses to guess which repo the PR is in.
        self.create_repo(
            project=self.project, name=REPO, provider="integrations:github", external_id="other"
        )

        self._post()

        self.mock_make_scm.assert_not_called()
        self.mock_actions.create_pull_request_comment.assert_not_called()

    def test_skips_a_closed_pr(self) -> None:
        self._stopped_run()
        self.mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        self.mock_actions.get_pull_request.return_value = {"data": {"state": "closed"}}

        self._post()

        self.mock_actions.create_pull_request_comment.assert_not_called()

    def test_posts_on_an_open_pr_it_can_read(self) -> None:
        self._stopped_run()
        self.mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        self.mock_actions.get_pull_request.return_value = {"data": {"state": "open"}}

        self._post()

        self.mock_actions.create_pull_request_comment.assert_called_once()

    def test_skips_once_work_resumed(self) -> None:
        # Queued during the stop, but an iteration started before the task ran.
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)

        self._post()

        self.mock_actions.create_pull_request_comment.assert_not_called()
        seer_run.refresh_from_db()
        assert OUT_OF_CREDITS_COMMENT_EXTRA not in seer_run.extras

    def test_skips_when_paused(self) -> None:
        seer_run = self._stopped_run(extras={PAUSED_EXTRA: {"reason": "user_stop"}})

        self._post()

        self.mock_actions.create_pull_request_comment.assert_not_called()
        seer_run.refresh_from_db()
        assert OUT_OF_CREDITS_COMMENT_EXTRA not in seer_run.extras

    def test_skips_without_a_seer_run(self) -> None:
        self._post()

        self.mock_actions.create_pull_request_comment.assert_not_called()

    def test_skips_when_the_run_is_deleted_before_the_claim(self) -> None:
        seer_run = self._stopped_run()
        # A queryset delete keeps ``seer_run.id``, as a stale lookup would.
        SeerRun.objects.filter(id=seer_run.id).delete()

        with patch(f"{MODULE}.get_seer_run", return_value=seer_run):
            self._post()

        self.mock_make_scm.assert_not_called()
        self.mock_actions.create_pull_request_comment.assert_not_called()

    def test_failed_post_is_not_retried(self) -> None:
        seer_run = self._stopped_run()
        self.mock_actions.create_pull_request_comment.side_effect = Exception("boom")

        self._post()
        self._post()

        # Claimed before posting: a failure stays quiet rather than risk two comments.
        self.mock_actions.create_pull_request_comment.assert_called_once()
        seer_run.refresh_from_db()
        assert OUT_OF_CREDITS_COMMENT_EXTRA in seer_run.extras

    def test_unsupported_provider_does_not_post(self) -> None:
        self._stopped_run()
        self.mock_make_scm.return_value = object()

        self._post()

        self.mock_actions.create_pull_request_comment.assert_not_called()


class ClearOutOfCreditsCommentTest(TestCase):
    def test_clears_the_marker(self) -> None:
        seer_run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=RUN_ID,
            extras={OUT_OF_CREDITS_COMMENT_EXTRA: {"denial_reason": None}, "other": 1},
        )

        clear_out_of_credits_comment(run_id=RUN_ID, organization_id=self.organization.id)

        seer_run.refresh_from_db()
        assert seer_run.extras == {"other": 1}

    def test_without_a_seer_run_does_nothing(self) -> None:
        clear_out_of_credits_comment(run_id=RUN_ID, organization_id=self.organization.id)
