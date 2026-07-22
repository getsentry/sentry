from datetime import timedelta
from unittest import mock

import responses
from django.utils import timezone

from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.seer.autofix.pr_ci_status import FAILURE_CONCLUSIONS, get_pr_ci_status
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache

HEAD_SHA = "abc123"


def test_failure_conclusions_match_raw_strings() -> None:
    # The enum members must subclass str so raw API conclusions match the tuple.
    for raw in ("failure", "timed_out", "action_required", "startup_failure"):
        assert raw in FAILURE_CONCLUSIONS
    assert "success" not in FAILURE_CONCLUSIONS


class GetPrCiStatusTest(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def setUp(self, get_jwt: mock.MagicMock) -> None:
        super().setUp()
        cache.clear()
        ten_days = timezone.now() + timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={
                "access_token": "12345token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id="123",
            integration_id=self.integration.id,
        )
        self.pr = self._create_pr(head_commit_sha=HEAD_SHA)

    def _create_pr(
        self, *, key: str = "7", head_commit_sha: str | None = HEAD_SHA, state: str | None = None
    ) -> PullRequest:
        return PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key=key,
            head_commit_sha=head_commit_sha,
            state=state,
        )

    def _add_check_runs(self, check_runs: list[dict], sha: str = HEAD_SHA) -> None:
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{self.repo.name}/commits/{sha}/check-runs",
            json={"total_count": len(check_runs), "check_runs": check_runs},
        )

    @responses.activate
    def test_failed_when_any_run_failed(self) -> None:
        self._add_check_runs(
            [
                {"status": "completed", "conclusion": "success"},
                {"status": "completed", "conclusion": "failure"},
            ]
        )
        assert get_pr_ci_status(self.pr) == "failed"

    @responses.activate
    def test_running_when_any_run_incomplete(self) -> None:
        self._add_check_runs(
            [
                {"status": "completed", "conclusion": "success"},
                {"status": "in_progress", "conclusion": None},
            ]
        )
        assert get_pr_ci_status(self.pr) == "running"

    @responses.activate
    def test_failed_when_startup_failure(self) -> None:
        self._add_check_runs([{"status": "completed", "conclusion": "startup_failure"}])
        assert get_pr_ci_status(self.pr) == "failed"

    @responses.activate
    def test_failure_on_second_page_is_seen(self) -> None:
        url = (
            f"https://api.github.com/repos/{self.repo.name}/commits/{HEAD_SHA}"
            f"/check-runs?per_page=100"
        )
        responses.add(
            method=responses.GET,
            url=url,
            json={"check_runs": [{"status": "completed", "conclusion": "success"}]},
            headers={"link": f'<{url}&page=2>; rel="next"'},
        )
        responses.add(
            method=responses.GET,
            url=f"{url}&page=2",
            json={"check_runs": [{"status": "completed", "conclusion": "failure"}]},
        )

        assert get_pr_ci_status(self.pr) == "failed"
        assert len(responses.calls) == 2

    @responses.activate
    def test_passed_when_all_runs_non_failing_and_complete(self) -> None:
        self._add_check_runs(
            [
                {"status": "completed", "conclusion": "success"},
                {"status": "completed", "conclusion": "neutral"},
                {"status": "completed", "conclusion": "skipped"},
            ]
        )
        assert get_pr_ci_status(self.pr) == "passed"

    @responses.activate
    def test_none_when_no_check_runs(self) -> None:
        self._add_check_runs([])
        assert get_pr_ci_status(self.pr) is None

    @responses.activate
    def test_merged_and_closed_prs_skipped_without_github_call(self) -> None:
        for key, state in (
            ("8", PullRequestLifecycleState.MERGED),
            ("9", PullRequestLifecycleState.CLOSED),
        ):
            pr = self._create_pr(key=key, state=state)
            assert get_pr_ci_status(pr) is None
            assert len(responses.calls) == 0

    @responses.activate
    def test_non_github_provider_returns_none(self) -> None:
        self.repo.update(provider="integrations:gitlab")
        assert get_pr_ci_status(self.pr) is None
        assert len(responses.calls) == 0

    @responses.activate
    def test_github_enterprise_provider_computes_status(self) -> None:
        ten_days = timezone.now() + timedelta(days=10)
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="Github Enterprise Test Org",
            external_id="github.example.org:1",
            metadata={
                "access_token": "12345token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
                "icon": "https://github.example.org/avatar.png",
                "domain_name": "github.example.org/Test-Organization",
                "account_type": "Organization",
                "installation_id": "install_id_1",
                "installation": {
                    "client_id": "client_id",
                    "client_secret": "client_secret",
                    "id": "2",
                    "name": "test-app",
                    "private_key": "private_key",
                    "url": "github.example.org",
                    "webhook_secret": "webhook_secret",
                    "verify_ssl": True,
                },
            },
        )
        ghe_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/bar",
            url="https://github.example.org/Test-Organization/bar",
            provider="integrations:github_enterprise",
            external_id="456",
            integration_id=integration.id,
        )
        pr = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=ghe_repo.id,
            key="11",
            head_commit_sha=HEAD_SHA,
        )
        responses.add(
            method=responses.GET,
            url=(
                f"https://github.example.org/api/v3/repos/{ghe_repo.name}"
                f"/commits/{HEAD_SHA}/check-runs"
            ),
            json={"check_runs": [{"status": "completed", "conclusion": "success"}]},
        )

        with mock.patch(
            "sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1"
        ):
            assert get_pr_ci_status(pr) == "passed"

    @responses.activate
    def test_missing_head_sha_resolved_via_get_pull_request(self) -> None:
        pr = self._create_pr(key="10", head_commit_sha=None)
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{self.repo.name}/pulls/{pr.key}",
            json={"head": {"sha": HEAD_SHA}},
        )
        self._add_check_runs([{"status": "completed", "conclusion": "success"}])

        assert get_pr_ci_status(pr) == "passed"
        assert any("/pulls/" in call.request.url for call in responses.calls)

    @responses.activate
    def test_github_error_returns_none_and_negative_caches(self) -> None:
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{self.repo.name}/commits/{HEAD_SHA}/check-runs",
            status=500,
        )

        assert get_pr_ci_status(self.pr) is None
        assert len(responses.calls) == 1

        # Second call within the negative-cache TTL makes no HTTP request.
        assert get_pr_ci_status(self.pr) is None
        assert len(responses.calls) == 1

    @responses.activate
    def test_cache_hit_skips_github(self) -> None:
        self._add_check_runs([{"status": "completed", "conclusion": "success"}])

        assert get_pr_ci_status(self.pr) == "passed"
        assert len(responses.calls) == 1

        assert get_pr_ci_status(self.pr) == "passed"
        assert len(responses.calls) == 1

    @responses.activate
    def test_failure_takes_precedence_over_running(self) -> None:
        self._add_check_runs(
            [
                {"status": "in_progress", "conclusion": None},
                {"status": "completed", "conclusion": "failure"},
            ]
        )
        assert get_pr_ci_status(self.pr) == "failed"

    @responses.activate
    def test_cache_keys_are_isolated_per_pr(self) -> None:
        other_pr = self._create_pr(key="12", head_commit_sha="def456")
        self._add_check_runs([{"status": "completed", "conclusion": "success"}])
        self._add_check_runs([{"status": "completed", "conclusion": "failure"}], sha="def456")

        assert get_pr_ci_status(self.pr) == "passed"
        assert len(responses.calls) == 1

        # The second PR must not read the first PR's cached result.
        assert get_pr_ci_status(other_pr) == "failed"
        assert len(responses.calls) == 2

    @responses.activate
    def test_new_head_sha_invalidates_cache(self) -> None:
        self._add_check_runs([{"status": "completed", "conclusion": "success"}])
        self._add_check_runs([{"status": "completed", "conclusion": "failure"}], sha="def456")

        assert get_pr_ci_status(self.pr) == "passed"
        assert len(responses.calls) == 1

        # A push updates the stored head sha; the old head's cached status must
        # not be served, and the new head is fetched immediately.
        self.pr.update(head_commit_sha="def456")
        assert get_pr_ci_status(self.pr) == "failed"
        assert len(responses.calls) == 2
