from sentry.models.pullrequest import PullRequest, PullRequestMetrics
from sentry.testutils.cases import TestCase


class PullRequestMetricsFileStatsTest(TestCase):
    def test_file_stats_defaults_to_none_and_roundtrips(self) -> None:
        repo = self.create_repo(project=self.project)
        pr = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=repo.id,
            key="1",
        )
        metrics = PullRequestMetrics.objects.create(pull_request=pr)
        assert metrics.file_stats is None

        payload = [{"path": "a.py", "additions": 3, "deletions": 1, "status": "modified"}]
        metrics.file_stats = payload
        metrics.save(update_fields=["file_stats"])
        metrics.refresh_from_db()
        assert metrics.file_stats == payload
