from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.pr_metrics.tasks import forward_pr_to_seer_task, reap_stuck_judge_verdicts_task
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class ForwardPrToSeerTaskTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )

    def _run(self, **overrides: Any) -> None:
        forward_pr_to_seer_task(
            pull_request_id=overrides.get("pull_request_id", self.pull_request.id),
            organization_id=overrides.get("organization_id", self.organization.id),
            repository_id=overrides.get("repository_id", self.repo.id),
        )

    @patch("sentry.pr_metrics.tasks.forward_pr_to_seer_judge")
    def test_forwards_resolved_pr_and_repo(self, mock_forward: Any) -> None:
        self._run()
        mock_forward.assert_called_once_with(self.pull_request, self.repo)

    @patch("sentry.pr_metrics.tasks.forward_pr_to_seer_judge")
    def test_missing_pull_request_is_dropped(self, mock_forward: Any) -> None:
        self._run(pull_request_id=self.pull_request.id + 1000)
        assert mock_forward.call_count == 0

    @patch("sentry.pr_metrics.tasks.forward_pr_to_seer_judge")
    def test_pull_request_scoped_to_org_and_repo(self, mock_forward: Any) -> None:
        # A PR id that doesn't belong to the reported org isn't forwarded — the
        # lookup stays tenant-scoped like the rest of the pipeline.
        other_org = self.create_organization()
        self._run(organization_id=other_org.id)
        assert mock_forward.call_count == 0

    @patch("sentry.pr_metrics.tasks.forward_pr_to_seer_judge")
    def test_pull_request_scoped_to_repository(self, mock_forward: Any) -> None:
        # The PR lookup is scoped to the reported repo, so a mismatched repository_id
        # resolves no PR and nothing is forwarded.
        self._run(repository_id=self.repo.id + 1000)
        assert mock_forward.call_count == 0


@cell_silo_test
class CleanupPrActivityTaskTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )

    def _create_activity(self, webhook_id: str) -> None:
        from sentry.models.pullrequest import PullRequestActivity, PullRequestActivityType

        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id=webhook_id,
            event_type=PullRequestActivityType.OPENED,
            payload={},
        )

    def test_deletes_activity_rows_for_pr(self) -> None:
        from sentry.models.pullrequest import PullRequestActivity
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        self._create_activity("delivery-1")
        self._create_activity("delivery-2")

        cleanup_pr_activity_task(pull_request_id=self.pull_request.id)

        assert not PullRequestActivity.objects.filter(pull_request=self.pull_request).exists()

    def test_no_op_when_no_rows_exist(self) -> None:
        from sentry.models.pullrequest import PullRequestActivity
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        cleanup_pr_activity_task(pull_request_id=self.pull_request.id)

        assert not PullRequestActivity.objects.filter(pull_request=self.pull_request).exists()

    def test_does_not_delete_rows_for_other_prs(self) -> None:
        from sentry.models.pullrequest import PullRequestActivity, PullRequestActivityType
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        other_pr = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="99"
        )
        PullRequestActivity.objects.create(
            pull_request=other_pr,
            webhook_id="delivery-other",
            event_type=PullRequestActivityType.OPENED,
            payload={},
        )
        self._create_activity("delivery-1")

        cleanup_pr_activity_task(pull_request_id=self.pull_request.id)

        assert not PullRequestActivity.objects.filter(pull_request=self.pull_request).exists()
        assert PullRequestActivity.objects.filter(pull_request=other_pr).exists()

    def test_require_untracked_deletes_both_stores(self) -> None:
        from sentry.models.pullrequest import PullRequestActivity, PullRequestActivityLog
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        self.pull_request.update(closed_at=datetime.now(timezone.utc))
        self._create_activity("delivery-1")
        PullRequestActivityLog.objects.create(pull_request=self.pull_request, data={"version": 1})

        cleanup_pr_activity_task(pull_request_id=self.pull_request.id, require_untracked=True)

        assert not PullRequestActivity.objects.filter(pull_request=self.pull_request).exists()
        assert not PullRequestActivityLog.objects.filter(pull_request=self.pull_request).exists()

    def test_require_untracked_keeps_activity_once_attribution_lands(self) -> None:
        # Attribution arrived while the sweep was waiting out the buffer. The PR can
        # now emit on a redelivered close, and must read real activity when it does.
        from sentry.models.pullrequest import PullRequestActivity
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        self.pull_request.update(closed_at=datetime.now(timezone.utc))
        self._create_activity("delivery-1")
        PullRequestAttribution.objects.create(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=True,
        )

        cleanup_pr_activity_task(pull_request_id=self.pull_request.id, require_untracked=True)

        assert PullRequestActivity.objects.filter(pull_request=self.pull_request).exists()

    def test_require_untracked_ignores_invalid_attribution(self) -> None:
        # Only valid attribution makes a PR emittable, so an invalidated row must
        # not hold its activity open.
        from sentry.models.pullrequest import PullRequestActivity
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        self.pull_request.update(closed_at=datetime.now(timezone.utc))
        self._create_activity("delivery-1")
        PullRequestAttribution.objects.create(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=False,
        )

        cleanup_pr_activity_task(pull_request_id=self.pull_request.id, require_untracked=True)

        assert not PullRequestActivity.objects.filter(pull_request=self.pull_request).exists()

    def test_require_untracked_keeps_activity_when_reopened(self) -> None:
        # Reopened while the sweep waited: no longer terminal, so it can accumulate
        # activity again. A later re-close reschedules the sweep.
        from sentry.models.pullrequest import PullRequestActivity
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        self.pull_request.update(closed_at=None)
        self._create_activity("delivery-1")

        cleanup_pr_activity_task(pull_request_id=self.pull_request.id, require_untracked=True)

        assert PullRequestActivity.objects.filter(pull_request=self.pull_request).exists()

    def test_require_untracked_tolerates_missing_pull_request(self) -> None:
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        cleanup_pr_activity_task(
            pull_request_id=self.pull_request.id + 1000, require_untracked=True
        )

    def test_emit_path_deletes_tracked_pr_activity(self) -> None:
        # Without require_untracked the delete is unconditional: the emit path only
        # calls it after the row has been emitted and the activity consumed.
        from sentry.models.pullrequest import PullRequestActivity
        from sentry.pr_metrics.tasks import cleanup_pr_activity_task

        self._create_activity("delivery-1")
        PullRequestAttribution.objects.create(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=True,
        )

        cleanup_pr_activity_task(pull_request_id=self.pull_request.id)

        assert not PullRequestActivity.objects.filter(pull_request=self.pull_request).exists()


@cell_silo_test
class ReapStuckJudgeVerdictsTaskTest(TestCase):
    @patch("sentry.pr_metrics.tasks.reap_stuck_judge_verdicts")
    def test_delegates_to_reaper(self, mock_reap: Any) -> None:
        reap_stuck_judge_verdicts_task()
        mock_reap.assert_called_once_with()
