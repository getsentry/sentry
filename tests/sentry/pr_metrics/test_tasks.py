from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch

from django.utils import timezone

from sentry import options
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityLog,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.pr_metrics.tasks import (
    forward_pr_to_seer_task,
    reap_stuck_judge_verdicts_task,
    sweep_unattributed_pr_activity_task,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
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


@cell_silo_test
class SweepUnattributedPrActivityTaskTest(TestCase):
    """The out-of-band sweep of activity belonging to PRs that never earned attribution."""

    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        # One full attribution buffer back, so anything written here is sweepable.
        self.quiet = timezone.now() - timedelta(hours=31)

    def _make_pr(self, key: str, *, when: datetime) -> PullRequest:
        with freeze_time(when):
            pr = self.create_pull_request(
                repository_id=self.repo.id, organization_id=self.organization.id, key=key
            )
            PullRequestActivity.objects.create(
                pull_request=pr,
                webhook_id=f"delivery-{key}",
                event_type=PullRequestActivityType.OPENED,
                payload={},
            )
            PullRequestActivityLog.objects.create(pull_request=pr, data={"version": 1})
        return pr

    def _attribute(self, pr: PullRequest, *, is_valid: bool = True) -> None:
        PullRequestAttribution.objects.create(
            pull_request=pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=is_valid,
        )

    def _has_activity(self, pr: PullRequest) -> bool:
        return (
            PullRequestActivity.objects.filter(pull_request=pr).exists()
            or PullRequestActivityLog.objects.filter(pull_request=pr).exists()
        )

    def test_sweeps_both_stores_for_a_quiet_unattributed_pr(self) -> None:
        pr = self._make_pr("1", when=self.quiet)

        sweep_unattributed_pr_activity_task()

        assert not PullRequestActivity.objects.filter(pull_request=pr).exists()
        assert not PullRequestActivityLog.objects.filter(pull_request=pr).exists()

    def test_keeps_activity_of_an_attributed_pr(self) -> None:
        # Attribution makes the PR emittable, so its activity still has a reader.
        pr = self._make_pr("1", when=self.quiet)
        self._attribute(pr)

        sweep_unattributed_pr_activity_task()

        assert PullRequestActivity.objects.filter(pull_request=pr).exists()
        assert PullRequestActivityLog.objects.filter(pull_request=pr).exists()

    def test_sweeps_pr_whose_only_attribution_is_invalid(self) -> None:
        # Emission requires a *valid* attribution, so an invalidated row leaves the
        # PR just as unemittable as one with none at all.
        pr = self._make_pr("1", when=self.quiet)
        self._attribute(pr, is_valid=False)

        sweep_unattributed_pr_activity_task()

        assert not self._has_activity(pr)

    def test_keeps_activity_still_inside_the_quiet_window(self) -> None:
        # Attribution may yet arrive for this PR, and the tracking gate is still
        # writing to it, so "unattributed" is not durable yet.
        pr = self._make_pr("1", when=timezone.now())

        sweep_unattributed_pr_activity_task()

        assert PullRequestActivity.objects.filter(pull_request=pr).exists()
        assert PullRequestActivityLog.objects.filter(pull_request=pr).exists()

    def test_sweeps_an_unattributed_pr_that_never_closed(self) -> None:
        # The terminal-event webhook can't reach these; the sweep is what covers them.
        pr = self._make_pr("1", when=self.quiet)
        assert pr.closed_at is None

        sweep_unattributed_pr_activity_task()

        assert not self._has_activity(pr)

    def _capped_stores(self, mock_metrics: Any) -> set[str]:
        return {
            call.kwargs["tags"]["store"]
            for call in mock_metrics.incr.call_args_list
            if call.args[0] == "pr_metrics.activity_sweep.capped"
        }

    @patch("sentry.pr_metrics.tasks._SWEEP_MAX_BATCHES", 1)
    @patch("sentry.pr_metrics.tasks._SWEEP_BATCH_SIZE", 1)
    def test_stops_at_the_batch_budget_and_leaves_the_rest(self) -> None:
        prs = [self._make_pr(str(i), when=self.quiet) for i in range(3)]

        sweep_unattributed_pr_activity_task()

        # One row per store per run, oldest first; the rest wait for the next run.
        assert PullRequestActivity.objects.filter(pull_request__in=prs).count() == 2
        assert PullRequestActivityLog.objects.filter(pull_request__in=prs).count() == 2

    @patch("sentry.pr_metrics.tasks._SWEEP_MAX_BATCHES", 1)
    @patch("sentry.pr_metrics.tasks._SWEEP_BATCH_SIZE", 1)
    @patch("sentry.pr_metrics.tasks.metrics")
    def test_reports_when_the_budget_ran_out(self, mock_metrics: Any) -> None:
        # The signal that the sweep is not keeping pace and max_batches needs raising.
        self._make_pr("1", when=self.quiet)
        self._make_pr("2", when=self.quiet)

        sweep_unattributed_pr_activity_task()

        assert self._capped_stores(mock_metrics) == {
            "PullRequestActivity",
            "PullRequestActivityLog",
        }

    @patch("sentry.pr_metrics.tasks.metrics")
    def test_reports_nothing_capped_when_work_runs_out(self, mock_metrics: Any) -> None:
        self._make_pr("1", when=self.quiet)

        sweep_unattributed_pr_activity_task()

        assert self._capped_stores(mock_metrics) == set()

    def test_abort_switch_deletes_nothing(self) -> None:
        pr = self._make_pr("1", when=self.quiet)

        with self.options({"cleanup.abort_execution": True}):
            sweep_unattributed_pr_activity_task()

        assert PullRequestActivity.objects.filter(pull_request=pr).exists()
        assert PullRequestActivityLog.objects.filter(pull_request=pr).exists()

    @patch("sentry.pr_metrics.tasks._SWEEP_BATCH_SIZE", 1)
    def test_abort_switch_stops_a_run_already_in_flight(self) -> None:
        # The switch is re-read per batch, so flipping it mid-run stops the sweep
        # rather than only preventing the next one.
        prs = [self._make_pr(str(i), when=self.quiet) for i in range(3)]
        real_get = options.get
        reads = {"n": 0}

        def abort_after_first_batch(key: str, *args: Any, **kwargs: Any) -> Any:
            if key != "cleanup.abort_execution":
                return real_get(key, *args, **kwargs)
            # False on entry, True from the second batch onwards.
            reads["n"] += 1
            return reads["n"] > 1

        with patch("sentry.pr_metrics.tasks.options.get", side_effect=abort_after_first_batch):
            sweep_unattributed_pr_activity_task()

        # One batch landed before the switch was seen; the remaining two survive.
        assert PullRequestActivity.objects.filter(pull_request__in=prs).count() == 2

    @patch("sentry.pr_metrics.tasks.metrics")
    def test_abort_is_reported_separately_from_capped(self, mock_metrics: Any) -> None:
        # Switched off and falling behind call for opposite responses, so the two
        # signals must not be conflated.
        self._make_pr("1", when=self.quiet)

        with self.options({"cleanup.abort_execution": True}):
            sweep_unattributed_pr_activity_task()

        aborted = {
            call.kwargs["tags"]["store"]
            for call in mock_metrics.incr.call_args_list
            if call.args[0] == "pr_metrics.activity_sweep.aborted"
        }
        assert aborted == {"PullRequestActivity", "PullRequestActivityLog"}
        assert self._capped_stores(mock_metrics) == set()

    @patch("sentry.pr_metrics.tasks._SWEEP_MAX_BATCHES", 1)
    @patch("sentry.pr_metrics.tasks._SWEEP_BATCH_SIZE", 2)
    @patch("sentry.pr_metrics.tasks.metrics")
    def test_partial_final_batch_is_not_reported_as_capped(self, mock_metrics: Any) -> None:
        # A short batch drains the queue, so a run that ends on one is finished
        # rather than behind — reporting it would fire the counter in normal
        # operation, where a run almost always ends mid-batch.
        self._make_pr("1", when=self.quiet)

        sweep_unattributed_pr_activity_task()

        assert self._capped_stores(mock_metrics) == set()


@cell_silo_test
class ReapStuckJudgeVerdictsTaskTest(TestCase):
    @patch("sentry.pr_metrics.tasks.reap_stuck_judge_verdicts")
    def test_delegates_to_reaper(self, mock_reap: Any) -> None:
        reap_stuck_judge_verdicts_task()
        mock_reap.assert_called_once_with()
