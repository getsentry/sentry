from datetime import timedelta
from unittest import mock

import orjson
import responses
from django.utils import timezone

from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.seer.autofix.pr_ci_status import get_pr_ci_status, get_pr_ci_statuses
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache

HEAD_SHA = "abc123"
GRAPHQL_URL = "https://api.github.com/graphql"
RATE_LIMIT_URL = "https://api.github.com/rate_limit"

# Sentinel for "commit has no checks/statuses" (statusCheckRollup is null).
_NO_ROLLUP = object()


def _node(state):
    if state is _NO_ROLLUP:
        return {"commit": {"statusCheckRollup": None}}
    return {"commit": {"statusCheckRollup": {"state": state}}}


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
        self.pr = self._create_pr()

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

    def _mock_rate_limit(self, url: str = RATE_LIMIT_URL) -> None:
        responses.add(
            method=responses.GET,
            url=url,
            json={
                "resources": {
                    "graphql": {"limit": 5000, "used": 1, "remaining": 4999, "reset": 1613064000}
                }
            },
        )

    def _mock_graphql(self, *states, url: str = GRAPHQL_URL) -> None:
        """Register one /graphql response whose repoN/prN aliases carry the given rollup states."""
        self._mock_rate_limit()
        data = {
            f"repo{i}": {f"pr{i}": {"commits": {"nodes": [_node(state)]}}}
            for i, state in enumerate(states)
        }
        responses.add(method=responses.POST, url=url, json={"data": data})

    # --- rollup state -> status mapping ---------------------------------------------------------

    @responses.activate
    def test_success_maps_to_passed(self) -> None:
        self._mock_graphql("SUCCESS")
        assert get_pr_ci_status(self.pr) == "passed"

    @responses.activate
    def test_pending_maps_to_running(self) -> None:
        self._mock_graphql("PENDING")
        assert get_pr_ci_status(self.pr) == "running"

    @responses.activate
    def test_expected_maps_to_running(self) -> None:
        # A status context registered via the Status API but not yet reported is pending-like.
        self._mock_graphql("EXPECTED")
        assert get_pr_ci_status(self.pr) == "running"

    @responses.activate
    def test_failure_maps_to_failed(self) -> None:
        self._mock_graphql("FAILURE")
        assert get_pr_ci_status(self.pr) == "failed"

    @responses.activate
    def test_error_maps_to_failed(self) -> None:
        self._mock_graphql("ERROR")
        assert get_pr_ci_status(self.pr) == "failed"

    @responses.activate
    def test_null_rollup_maps_to_none(self) -> None:
        self._mock_graphql(_NO_ROLLUP)
        assert get_pr_ci_status(self.pr) is None

    @responses.activate
    def test_unknown_state_maps_to_none(self) -> None:
        self._mock_graphql("SOMETHING_NEW")
        assert get_pr_ci_status(self.pr) is None

    # --- semantic flips vs the old REST check-runs aggregation ----------------------------------

    @responses.activate
    def test_cancelled_build_now_maps_to_failed(self) -> None:
        # GitHub's rollup folds a cancelled check into FAILURE; the old check-runs path folded
        # cancelled into "passed". This is the single biggest observable divergence.
        self._mock_graphql("FAILURE")
        assert get_pr_ci_status(self.pr) == "failed"

    @responses.activate
    def test_commit_status_only_pr_now_gets_status(self) -> None:
        # The rollup counts legacy commit statuses (Status API); the old check-runs path ignored
        # them, so such a PR returned None before and now returns a real status.
        self._mock_graphql("SUCCESS")
        assert get_pr_ci_status(self.pr) == "passed"

    # --- skip / provider guards -----------------------------------------------------------------

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
    def test_non_integer_pr_key_returns_none(self) -> None:
        pr = self._create_pr(key="not-a-number")
        assert get_pr_ci_status(pr) is None
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
        self._mock_rate_limit(url="https://github.example.org/api/v3/rate_limit")
        responses.add(
            method=responses.POST,
            url="https://github.example.org/api/graphql",
            json={"data": {"repo0": {"pr0": {"commits": {"nodes": [_node("SUCCESS")]}}}}},
        )

        with mock.patch(
            "sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1"
        ):
            assert get_pr_ci_status(pr) == "passed"

    # --- caching --------------------------------------------------------------------------------

    @responses.activate
    def test_cache_hit_skips_github(self) -> None:
        self._mock_graphql("SUCCESS")

        assert get_pr_ci_status(self.pr) == "passed"
        calls_after_first = len(responses.calls)

        assert get_pr_ci_status(self.pr) == "passed"
        assert len(responses.calls) == calls_after_first

    @responses.activate
    def test_none_result_is_negative_cached(self) -> None:
        self._mock_graphql(_NO_ROLLUP)

        assert get_pr_ci_status(self.pr) is None
        calls_after_first = len(responses.calls)

        assert get_pr_ci_status(self.pr) is None
        assert len(responses.calls) == calls_after_first

    @responses.activate
    def test_transport_error_returns_none_and_negative_caches(self) -> None:
        self._mock_rate_limit()
        responses.add(method=responses.POST, url=GRAPHQL_URL, status=500)

        assert get_pr_ci_status(self.pr) is None
        calls_after_first = len(responses.calls)

        # Second call within the negative-cache TTL makes no HTTP request.
        assert get_pr_ci_status(self.pr) is None
        assert len(responses.calls) == calls_after_first

    @responses.activate
    def test_cache_keys_are_isolated_per_pr(self) -> None:
        other_pr = self._create_pr(key="12", head_commit_sha="def456")
        self._mock_graphql("SUCCESS")

        assert get_pr_ci_status(self.pr) == "passed"

        # The second PR must not read the first PR's cached result; it fetches fresh.
        self._mock_graphql("FAILURE")
        assert get_pr_ci_status(other_pr) == "failed"

    @responses.activate
    def test_new_head_sha_invalidates_cache(self) -> None:
        self._mock_graphql("SUCCESS")
        assert get_pr_ci_status(self.pr) == "passed"

        # A push updates the stored head sha -> new cache key -> forced refetch.
        self.pr.update(head_commit_sha="def456")
        self._mock_graphql("FAILURE")
        assert get_pr_ci_status(self.pr) == "failed"

    # --- batching -------------------------------------------------------------------------------

    @responses.activate
    def test_batch_one_query_for_many_prs(self) -> None:
        pr2 = self._create_pr(key="8")
        pr3 = self._create_pr(key="9")
        self._mock_graphql("SUCCESS", "FAILURE", "PENDING")

        result = get_pr_ci_statuses([self.pr, pr2, pr3])

        assert result == {self.pr.id: "passed", pr2.id: "failed", pr3.id: "running"}
        # One rate-limit GET + one graphql POST for the whole page.
        assert len(responses.calls) == 2
        variables = orjson.loads(responses.calls[1].request.body)["variables"]
        assert variables["p0"] == 7
        assert variables["p1"] == 8
        assert variables["p2"] == 9

    @responses.activate
    def test_batch_mixes_cache_hits_and_misses(self) -> None:
        # Prime the cache for self.pr, then a batch only queries the uncached PR.
        self._mock_graphql("SUCCESS")
        assert get_pr_ci_status(self.pr) == "passed"

        pr2 = self._create_pr(key="8")
        self._mock_graphql("FAILURE")

        result = get_pr_ci_statuses([self.pr, pr2])
        assert result == {self.pr.id: "passed", pr2.id: "failed"}
        variables = orjson.loads(responses.calls[-1].request.body)["variables"]
        assert "p0" in variables
        assert "p1" not in variables

    @responses.activate
    def test_skipped_prs_do_not_join_the_batch(self) -> None:
        merged = self._create_pr(key="8", state=PullRequestLifecycleState.MERGED)
        self._mock_graphql("SUCCESS")

        result = get_pr_ci_statuses([self.pr, merged])

        assert result == {self.pr.id: "passed", merged.id: None}
        variables = orjson.loads(responses.calls[1].request.body)["variables"]
        assert "p1" not in variables
