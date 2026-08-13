from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.source_code_management.pr_id_cache import (
    PR_ID_CACHE_TTL_OPTION,
    get_cached_pr_id,
    get_or_fetch_pr_id,
    set_cached_pr_id,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

MODULE_PATH = "sentry.integrations.source_code_management.pr_id_cache"
METRICS_KEY = "integrations.source_code_management.pr_id_cache"
GITHUB = "integrations:github"


class PrIdCacheTest(TestCase):
    def test_set_then_get_round_trips(self) -> None:
        set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=279147437)

        assert (
            get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7) == 279147437
        )

    def test_get_misses_for_unknown_pr(self) -> None:
        assert get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=99) is None

    @patch(f"{MODULE_PATH}.metrics.incr")
    def test_unknown_pr_is_counted_as_a_miss(self, mock_incr: MagicMock) -> None:
        get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=99)

        assert [(call.args[0], call.kwargs["tags"]) for call in mock_incr.call_args_list] == [
            (f"{METRICS_KEY}.get", {"result": "miss"}),
        ]

    @patch(f"{MODULE_PATH}.cache")
    def test_unusable_cached_value_is_not_returned(self, mock_cache: MagicMock) -> None:
        # `True` is the one worth pinning: bool is an int subclass, so it would
        # sail through an isinstance check and be handed back as a PR id.
        mock_cache.get.return_value = True

        assert get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7) is None

    @patch(f"{MODULE_PATH}.metrics.incr")
    @patch(f"{MODULE_PATH}.cache")
    def test_unusable_cached_value_is_counted_apart_from_a_miss(
        self, mock_cache: MagicMock, mock_incr: MagicMock
    ) -> None:
        # Nothing here writes a non-int, so one turning up means the entry did
        # not come from `set_cached_pr_id`. Counted as a miss it would be
        # indistinguishable from ordinary cold-cache traffic.
        mock_cache.get.return_value = "279147437"

        get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7)

        assert [(call.args[0], call.kwargs["tags"]) for call in mock_incr.call_args_list] == [
            (f"{METRICS_KEY}.get", {"result": "invalid"}),
        ]

    def test_pr_number_scopes_the_entry(self) -> None:
        set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=111)

        assert get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=8) is None

    def test_repo_scopes_the_entry(self) -> None:
        set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=111)

        assert get_cached_pr_id(provider=GITHUB, repo_external_id="999999", pr_number=7) is None

    def test_missing_repo_external_id_is_not_cached(self) -> None:
        set_cached_pr_id(provider=GITHUB, repo_external_id=None, pr_number=7, pr_id=111)

        assert get_cached_pr_id(provider=GITHUB, repo_external_id=None, pr_number=7) is None

    @patch(f"{MODULE_PATH}.metrics.incr")
    def test_missing_repo_external_id_is_counted(self, mock_incr: MagicMock) -> None:
        # `Repository.external_id` is nullable, so this is how we find out how
        # many lookups a null one costs us.
        set_cached_pr_id(provider=GITHUB, repo_external_id=None, pr_number=7, pr_id=111)
        get_cached_pr_id(provider=GITHUB, repo_external_id=None, pr_number=7)

        assert [(call.args[0], call.kwargs["tags"]) for call in mock_incr.call_args_list] == [
            (f"{METRICS_KEY}.set", {"result": "unkeyable", "missing": "repo_external_id"}),
            (f"{METRICS_KEY}.get", {"result": "unkeyable", "missing": "repo_external_id"}),
        ]

    @patch(f"{MODULE_PATH}.metrics.incr")
    def test_missing_provider_is_counted(self, mock_incr: MagicMock) -> None:
        # `Repository.provider` is nullable too, and a row without one is broken
        # rather than merely unsupported — so it is counted wherever it comes
        # from, before the supported-provider check can absorb it.
        set_cached_pr_id(provider=None, repo_external_id="654321", pr_number=7, pr_id=111)
        get_cached_pr_id(provider=None, repo_external_id="654321", pr_number=7)

        assert [(call.args[0], call.kwargs["tags"]) for call in mock_incr.call_args_list] == [
            (f"{METRICS_KEY}.set", {"result": "unkeyable", "missing": "provider"}),
            (f"{METRICS_KEY}.get", {"result": "unkeyable", "missing": "provider"}),
        ]

    @patch(f"{MODULE_PATH}.metrics.incr")
    def test_unsupported_provider_is_not_counted(self, mock_incr: MagicMock) -> None:
        # A present-but-unsupported provider is working as designed. Counting it
        # would bury the broken rows under traffic that was never cacheable —
        # including its missing external id, which never reaches that check.
        set_cached_pr_id(
            provider="integrations:github_enterprise", repo_external_id=None, pr_number=7, pr_id=111
        )
        get_cached_pr_id(
            provider="integrations:github_enterprise", repo_external_id=None, pr_number=7
        )

        mock_incr.assert_not_called()

    def test_github_enterprise_is_not_cached(self) -> None:
        # GitHub Enterprise repo ids restart at 1 on every instance, so an entry
        # keyed on the provider string alone could name another host's repo.
        set_cached_pr_id(
            provider="integrations:github_enterprise",
            repo_external_id="1",
            pr_number=7,
            pr_id=111,
        )

        assert (
            get_cached_pr_id(
                provider="integrations:github_enterprise", repo_external_id="1", pr_number=7
            )
            is None
        )

    @patch(f"{MODULE_PATH}.cache")
    def test_ttl_is_applied(self, mock_cache: MagicMock) -> None:
        with override_options({PR_ID_CACHE_TTL_OPTION: 3600}):
            set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=111)

        key, value, ttl = mock_cache.set.call_args[0]
        assert value == 111
        assert ttl == 3600
        assert key == "scm:pr-id:1:integrations:github:654321:7"

    @patch(f"{MODULE_PATH}.cache")
    def test_zero_ttl_stores_nothing(self, mock_cache: MagicMock) -> None:
        """The off switch, so an entry nothing will read is never written."""
        with override_options({PR_ID_CACHE_TTL_OPTION: 0}):
            set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=111)

        mock_cache.set.assert_not_called()

    @patch(f"{MODULE_PATH}.cache")
    def test_zero_ttl_reads_nothing(self, mock_cache: MagicMock) -> None:
        with override_options({PR_ID_CACHE_TTL_OPTION: 0}):
            assert (
                get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7) is None
            )

        mock_cache.get.assert_not_called()

    def test_zero_ttl_sends_every_caller_to_the_fetch(self) -> None:
        """Turning the cache off is a latency regression, never a wrong id."""
        calls = []

        def fetch() -> int | None:
            calls.append(1)
            return 279147437

        with override_options({PR_ID_CACHE_TTL_OPTION: 0}):
            for _ in range(2):
                assert (
                    get_or_fetch_pr_id(
                        provider=GITHUB,
                        repo_external_id="654321",
                        pr_number=7,
                        fetch=fetch,
                    )
                    == 279147437
                )

        assert len(calls) == 2

    @patch(f"{MODULE_PATH}.metrics.incr")
    @patch(f"{MODULE_PATH}.cache")
    def test_disabled_is_counted_apart_from_a_miss(
        self, mock_cache: MagicMock, mock_incr: MagicMock
    ) -> None:
        with override_options({PR_ID_CACHE_TTL_OPTION: 0}):
            get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7)
            set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=111)

        assert mock_incr.call_args_list[0].kwargs["tags"] == {"result": "disabled"}
        assert mock_incr.call_args_list[1].kwargs["tags"] == {"result": "disabled"}

    @patch(f"{MODULE_PATH}.cache")
    def test_cache_backend_failure_on_set_is_swallowed(self, mock_cache: MagicMock) -> None:
        mock_cache.set.side_effect = RuntimeError("cache is down")

        set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=111)

    @patch(f"{MODULE_PATH}.cache")
    def test_cache_backend_failure_on_get_reads_as_a_miss(self, mock_cache: MagicMock) -> None:
        mock_cache.get.side_effect = RuntimeError("cache is down")

        assert get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7) is None


class PrIdCacheKeyScopeTest(TestCase):
    def test_key_is_unaffected_by_sentry_org(self) -> None:
        # One GitHub App installation can be linked to several Sentry orgs; the
        # mapping is a fact about GitHub, so every org must share one entry.
        other_org = self.create_organization()
        repo = self.create_repo(
            project=self.project, provider=GITHUB, external_id="654321", name="owner/repo"
        )
        other_repo = self.create_repo(
            project=self.create_project(organization=other_org),
            provider=GITHUB,
            external_id="654321",
            name="owner/repo",
        )
        assert repo.organization_id != other_repo.organization_id

        set_cached_pr_id(
            provider=repo.provider,
            repo_external_id=repo.external_id,
            pr_number=7,
            pr_id=279147437,
        )

        assert (
            get_cached_pr_id(
                provider=other_repo.provider,
                repo_external_id=other_repo.external_id,
                pr_number=7,
            )
            == 279147437
        )


class GetOrFetchPrIdTest(TestCase):
    def test_hit_does_not_call_fetch(self) -> None:
        set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=111)
        fetch = MagicMock()

        result = get_or_fetch_pr_id(
            provider=GITHUB, repo_external_id="654321", pr_number=7, fetch=fetch
        )

        assert result == 111
        fetch.assert_not_called()

    def test_miss_fetches_and_populates(self) -> None:
        fetch = MagicMock(return_value=222)

        result = get_or_fetch_pr_id(
            provider=GITHUB, repo_external_id="654321", pr_number=7, fetch=fetch
        )

        assert result == 222
        fetch.assert_called_once_with()
        assert get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7) == 222

    def test_negative_result_is_not_cached(self) -> None:
        fetch = MagicMock(return_value=None)

        assert (
            get_or_fetch_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, fetch=fetch)
            is None
        )
        assert get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7) is None

        # The next call still asks the provider, so a transient failure cannot
        # become a persistent one.
        fetch.return_value = 333
        assert (
            get_or_fetch_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, fetch=fetch)
            == 333
        )

    def test_unkeyable_repo_still_fetches(self) -> None:
        # A repo we cannot key is a permanent miss, not a failure: the caller
        # keeps paying the REST call it already paid before this cache existed.
        fetch = MagicMock(return_value=444)

        result = get_or_fetch_pr_id(
            provider=GITHUB, repo_external_id=None, pr_number=7, fetch=fetch
        )

        assert result == 444
        fetch.assert_called_once_with()

    def test_unsupported_provider_still_fetches(self) -> None:
        fetch = MagicMock(return_value=555)

        result = get_or_fetch_pr_id(
            provider="integrations:github_enterprise",
            repo_external_id="1",
            pr_number=7,
            fetch=fetch,
        )

        assert result == 555
        fetch.assert_called_once_with()

    def test_fetch_exception_propagates(self) -> None:
        fetch = MagicMock(side_effect=ValueError("boom"))

        with pytest.raises(ValueError):
            get_or_fetch_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, fetch=fetch)

        assert get_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7) is None
