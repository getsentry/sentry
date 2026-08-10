from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.testutils.cases import TestCase

REPO_NAME = "owner/repo"


class RunMarkersTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=1, user_id=self.user.id
        )

    def test_records_and_reads_marker(self) -> None:
        record_run_marker(self.seer_run, "review_requests", REPO_NAME, {"reviewers": ["octocat"]})

        self.seer_run.refresh_from_db()
        assert get_run_marker(self.seer_run, "review_requests", REPO_NAME) == {
            "reviewers": ["octocat"]
        }
        assert get_run_marker(self.seer_run, "review_requests", "other/repo") is None
        assert get_run_marker(self.seer_run, "cap_exhausted", REPO_NAME) is None

    def test_stale_instance_preserves_other_features_marker(self) -> None:
        # Two features race on the same run: each loads its own instance, then
        # writes its own marker key. The second write must not clobber the
        # first even though its in-memory instance predates it.
        stale = SeerRun.objects.get(id=self.seer_run.id)
        record_run_marker(self.seer_run, "review_requests", REPO_NAME, {"reviewers": ["octocat"]})

        record_run_marker(stale, "cap_exhausted", REPO_NAME, {"assignees": ["octocat"]})

        self.seer_run.refresh_from_db()
        assert get_run_marker(self.seer_run, "review_requests", REPO_NAME) == {
            "reviewers": ["octocat"]
        }
        assert get_run_marker(self.seer_run, "cap_exhausted", REPO_NAME) == {
            "assignees": ["octocat"]
        }

    def test_stale_instance_preserves_other_repos_marker(self) -> None:
        stale = SeerRun.objects.get(id=self.seer_run.id)
        record_run_marker(self.seer_run, "review_requests", "other/repo", {"reviewers": ["alice"]})

        record_run_marker(stale, "review_requests", REPO_NAME, {"reviewers": ["octocat"]})

        self.seer_run.refresh_from_db()
        assert get_run_marker(self.seer_run, "review_requests", "other/repo") == {
            "reviewers": ["alice"]
        }
        assert get_run_marker(self.seer_run, "review_requests", REPO_NAME) == {
            "reviewers": ["octocat"]
        }

    def test_overwrites_same_feature_and_repo(self) -> None:
        record_run_marker(self.seer_run, "review_requests", REPO_NAME, {"reviewers": ["octocat"]})
        record_run_marker(self.seer_run, "review_requests", REPO_NAME, {"reviewers": ["alice"]})

        self.seer_run.refresh_from_db()
        assert get_run_marker(self.seer_run, "review_requests", REPO_NAME) == {
            "reviewers": ["alice"]
        }

    def test_updates_caller_instance_in_memory(self) -> None:
        record_run_marker(self.seer_run, "review_requests", REPO_NAME, {"reviewers": ["octocat"]})

        # The caller's instance reflects the write without a refresh, so marker
        # re-checks against it see the fresh state.
        assert get_run_marker(self.seer_run, "review_requests", REPO_NAME) == {
            "reviewers": ["octocat"]
        }
