from typing import Any
from unittest.mock import patch

from sentry.models.pullrequest import PullRequestMetrics
from sentry.pr_metrics.tasks import (
    fetch_pr_file_stats_task,
    forward_pr_to_seer_task,
    reap_stuck_judge_verdicts_task,
)
from sentry.seer.models.run import SeerRun, SeerRunPullRequest, SeerRunType
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


@cell_silo_test
class ReapStuckJudgeVerdictsTaskTest(TestCase):
    @patch("sentry.pr_metrics.tasks.reap_stuck_judge_verdicts")
    def test_delegates_to_reaper(self, mock_reap: Any) -> None:
        reap_stuck_judge_verdicts_task()
        mock_reap.assert_called_once_with()


@cell_silo_test
class FetchPrFileStatsTaskTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="7"
        )

    def _link_autofix(self) -> None:
        run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.EXPLORER,
            last_triggered_at=self.pull_request.date_added,
        )
        SeerRunPullRequest.objects.create(seer_run=run, pull_request=self.pull_request)

    def _run(self, **overrides: Any) -> None:
        fetch_pr_file_stats_task(
            pull_request_id=overrides.get("pull_request_id", self.pull_request.id),
            organization_id=overrides.get("organization_id", self.organization.id),
            repository_id=overrides.get("repository_id", self.repo.id),
        )

    @patch("sentry.pr_metrics.tasks.fetch_pr_file_stats")
    def test_writes_onto_existing_row(self, mock_fetch: Any) -> None:
        self._link_autofix()
        metrics_row = PullRequestMetrics.objects.create(pull_request=self.pull_request)
        stats = [{"path": "a.py", "additions": 3, "deletions": 1, "status": "modified"}]
        mock_fetch.return_value = stats

        with self.feature("organizations:pr-file-stats"):
            self._run()

        mock_fetch.assert_called_once_with(self.organization, self.repo, self.pull_request.key)
        metrics_row.refresh_from_db()
        assert metrics_row.file_stats == stats

    @patch("sentry.pr_metrics.tasks.fetch_pr_file_stats")
    def test_empty_result_does_not_overwrite_prior_stats(self, mock_fetch: Any) -> None:
        # [] can mean a transient GitHub failure, so an empty result must never clobber
        # stats a previous run already stored.
        self._link_autofix()
        prior = [{"path": "a.py", "additions": 3, "deletions": 1, "status": "modified"}]
        metrics_row = PullRequestMetrics.objects.create(
            pull_request=self.pull_request, file_stats=prior
        )
        mock_fetch.return_value = []

        with self.feature("organizations:pr-file-stats"):
            self._run()

        mock_fetch.assert_called_once()
        metrics_row.refresh_from_db()
        assert metrics_row.file_stats == prior

    @patch("sentry.pr_metrics.tasks.fetch_pr_file_stats")
    def test_no_row_is_noop(self, mock_fetch: Any) -> None:
        self._link_autofix()
        mock_fetch.return_value = [
            {"path": "a.py", "additions": 1, "deletions": 0, "status": "added"}
        ]

        with self.feature("organizations:pr-file-stats"):
            self._run()

        mock_fetch.assert_not_called()
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()

    @patch("sentry.pr_metrics.tasks.fetch_pr_file_stats")
    def test_unlinked_pr_skips_fetch(self, mock_fetch: Any) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pull_request)

        with self.feature("organizations:pr-file-stats"):
            self._run()

        mock_fetch.assert_not_called()

    @patch("sentry.pr_metrics.tasks.fetch_pr_file_stats")
    def test_flag_off_skips_fetch(self, mock_fetch: Any) -> None:
        self._link_autofix()
        PullRequestMetrics.objects.create(pull_request=self.pull_request)

        with self.feature({"organizations:pr-file-stats": False}):
            self._run()

        mock_fetch.assert_not_called()

    @patch("sentry.pr_metrics.tasks.is_github_rate_limit_sensitive", return_value=True)
    @patch("sentry.pr_metrics.tasks.fetch_pr_file_stats")
    def test_rate_limit_sensitive_skips(self, mock_fetch: Any, _sensitive: Any) -> None:
        self._link_autofix()
        PullRequestMetrics.objects.create(pull_request=self.pull_request)

        with self.feature("organizations:pr-file-stats"):
            self._run()

        mock_fetch.assert_not_called()

    @patch("sentry.pr_metrics.tasks.fetch_pr_file_stats")
    def test_missing_pull_request_is_dropped(self, mock_fetch: Any) -> None:
        with self.feature("organizations:pr-file-stats"):
            self._run(pull_request_id=self.pull_request.id + 1000)

        mock_fetch.assert_not_called()

    @patch("sentry.pr_metrics.tasks.fetch_pr_file_stats")
    def test_pull_request_scoped_to_org(self, mock_fetch: Any) -> None:
        # The repo lookup resolves for the caller's org; only the PR's organization_id
        # scoping stops the cross-org read, since every later guard is satisfied.
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(
            other_project, name="other/repo", provider="integrations:github"
        )
        victim_pr = self.create_pull_request(
            repository_id=other_repo.id, organization_id=self.organization.id, key="99"
        )
        run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.EXPLORER,
            last_triggered_at=victim_pr.date_added,
        )
        SeerRunPullRequest.objects.create(seer_run=run, pull_request=victim_pr)
        PullRequestMetrics.objects.create(pull_request=victim_pr)

        with self.feature("organizations:pr-file-stats"):
            self._run(
                pull_request_id=victim_pr.id,
                organization_id=other_org.id,
                repository_id=other_repo.id,
            )

        mock_fetch.assert_not_called()
        assert PullRequestMetrics.objects.get(pull_request=victim_pr).file_stats is None
