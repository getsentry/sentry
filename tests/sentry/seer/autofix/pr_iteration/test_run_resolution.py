from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.source_code_management.pr_id_cache import (
    get_cached_pr_id,
    set_cached_pr_id,
)
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.run_resolution import (
    NO_RUN_CACHE_TTL_OPTION,
    get_run_state_for_pr_id,
    resolve_pr_id,
)
from sentry.seer.models import SeerApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

MODULE_PATH = "sentry.seer.autofix.pr_iteration.run_resolution"
METRICS_KEY = "autofix.pr_iteration.run_resolution"
GITHUB = "integrations:github"


def _run_state(run_id: int = 67890) -> SeerRunState:
    return SeerRunState(
        run_id=run_id,
        blocks=[],
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
        repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")},
        metadata={"group_id": 1},
    )


def _client(pr_id: int | None = 279147437) -> MagicMock:
    client = MagicMock()
    client.get_pull_request.return_value = {"id": pr_id} if pr_id is not None else {}
    return client


def _integration(client: MagicMock) -> MagicMock:
    """An integration whose installation hands back ``client``."""
    integration = MagicMock()
    integration.get_installation.return_value.get_client.return_value = client
    return integration


def _ref(pr_number: int, client: MagicMock | None = None) -> dict[str, Any]:
    """The identifying kwargs :func:`resolve_pr_id` takes, minus ``caller``."""
    return {
        "provider": GITHUB,
        "organization_id": 1,
        "integration": _integration(client if client is not None else _client()),
        "repo_external_id": "654321",
        "repo_name": "owner/repo",
        "pr_number": pr_number,
    }


class ResolvePrIdTest(TestCase):
    def test_reads_the_warmed_cache_without_touching_the_client(self) -> None:
        set_cached_pr_id(provider=GITHUB, repo_external_id="654321", pr_number=7, pr_id=279147437)
        client = _client()
        ref = _ref(7, client)

        assert resolve_pr_id(**ref, caller="mention") == 279147437

        client.get_pull_request.assert_not_called()
        # The client is not even built on a hit -- the whole reason the
        # integration is passed instead of a ready-made client.
        ref["integration"].get_installation.assert_not_called()

    def test_asks_the_provider_on_a_miss_and_stores_the_answer(self) -> None:
        client = _client()
        ref = _ref(8, client)

        assert resolve_pr_id(**ref, caller="mention") == 279147437
        client.get_pull_request.assert_called_once_with("owner/repo", "8")

        # Second call is served from the cache the first one warmed.
        assert resolve_pr_id(**ref, caller="mention") == 279147437
        assert client.get_pull_request.call_count == 1

    def test_a_response_without_an_id_is_none_rather_than_a_key_error(self) -> None:
        """A PR deleted or made private between webhook and task is not a crash."""
        assert resolve_pr_id(**_ref(9, _client(pr_id=None)), caller="mention") is None

    def test_provider_errors_propagate(self) -> None:
        """Callers keep their own ``except ApiError`` around this call."""
        client = _client()
        client.get_pull_request.side_effect = ValueError("boom")

        with pytest.raises(ValueError):
            resolve_pr_id(**_ref(10, client), caller="mention")

    def test_passes_the_callers_provider_to_the_cache(self) -> None:
        with patch(f"{MODULE_PATH}.get_or_fetch_pr_id", return_value=279147437) as mock_cache:
            resolve_pr_id(**_ref(7), caller="mention")

        assert mock_cache.call_args.kwargs["provider"] == GITHUB

    def test_a_ghe_ref_degrades_to_an_uncached_fetch_rather_than_colliding(self) -> None:
        """GHE repo ids are per-instance, so the cache declines to store them.

        The provider reaching ``pr_id_cache`` intact is what makes that decision
        possible -- pinned to github.com, this entry would be stored under an id
        that names a different repository on every other host.
        """
        client = _client()
        ghe_ref: dict[str, Any] = {
            "provider": "integrations:github_enterprise",
            "organization_id": 1,
            "integration": _integration(client),
            "repo_external_id": "1",
            "repo_name": "owner/repo",
            "pr_number": 7,
        }

        assert resolve_pr_id(**ghe_ref, caller="mention") == 279147437
        assert resolve_pr_id(**ghe_ref, caller="mention") == 279147437

        # Every call pays the round-trip, and nothing lands in github.com's keyspace.
        assert client.get_pull_request.call_count == 2
        assert get_cached_pr_id(provider=GITHUB, repo_external_id="1", pr_number=7) is None


class GetRunStateForPrIdTest(TestCase):
    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_returns_the_run_and_never_caches_it(self, mock_get_state: MagicMock) -> None:
        mock_get_state.return_value = _run_state()

        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=555, caller="mention"
            )
            is not None
        )
        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=555, caller="mention"
            )
            is not None
        )

        # Live, mutable state: every caller gets a fresh read.
        assert mock_get_state.call_count == 2
        mock_get_state.assert_called_with(self.organization.id, GITHUB, 555)

    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_absent_run_is_remembered(self, mock_get_state: MagicMock) -> None:
        mock_get_state.return_value = None

        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=556, caller="mention"
            )
            is None
        )
        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=556, caller="mention"
            )
            is None
        )

        assert mock_get_state.call_count == 1

    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_404_is_treated_as_absent_and_remembered(self, mock_get_state: MagicMock) -> None:
        mock_get_state.side_effect = SeerApiError("not found", 404)

        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=557, caller="mention"
            )
            is None
        )
        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=557, caller="mention"
            )
            is None
        )

        assert mock_get_state.call_count == 1

    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_other_seer_errors_raise_and_are_not_remembered(
        self, mock_get_state: MagicMock
    ) -> None:
        mock_get_state.side_effect = SeerApiError("boom", 500)

        with pytest.raises(SeerApiError):
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=558, caller="mention"
            )

        # A blip says nothing about whether a run exists, so the next call asks
        # again rather than going blind for a day.
        mock_get_state.side_effect = None
        mock_get_state.return_value = _run_state()
        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=558, caller="mention"
            )
            is not None
        )
        assert mock_get_state.call_count == 2

    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_negative_is_scoped_to_the_provider(self, mock_get_state: MagicMock) -> None:
        """A GHE PR id and a github.com PR id can be the same integer."""
        mock_get_state.return_value = None
        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id,
                provider="integrations:github_enterprise",
                pr_id=570,
                caller="mention",
            )
            is None
        )

        mock_get_state.return_value = _run_state()
        state = get_run_state_for_pr_id(
            organization_id=self.organization.id, provider=GITHUB, pr_id=570, caller="mention"
        )

        assert state is not None
        assert mock_get_state.call_count == 2

    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_asks_seer_under_the_callers_provider(self, mock_get_state: MagicMock) -> None:
        mock_get_state.return_value = _run_state()

        get_run_state_for_pr_id(
            organization_id=self.organization.id,
            provider="integrations:github_enterprise",
            pr_id=571,
            caller="mention",
        )

        mock_get_state.assert_called_once_with(
            self.organization.id, "integrations:github_enterprise", 571
        )

    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_negative_is_scoped_to_the_organization(self, mock_get_state: MagicMock) -> None:
        """One PR fans out across orgs; a 404 for one says nothing about the owner."""
        other_org = self.create_organization()
        mock_get_state.return_value = None

        assert (
            get_run_state_for_pr_id(
                organization_id=other_org.id, provider=GITHUB, pr_id=559, caller="mention"
            )
            is None
        )

        mock_get_state.return_value = _run_state()
        state = get_run_state_for_pr_id(
            organization_id=self.organization.id, provider=GITHUB, pr_id=559, caller="mention"
        )

        assert state is not None
        assert mock_get_state.call_count == 2

    @patch(f"{MODULE_PATH}.cache")
    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_unreadable_cache_falls_through_to_seer(
        self, mock_get_state: MagicMock, mock_cache: MagicMock
    ) -> None:
        mock_cache.get.side_effect = Exception("cache down")
        mock_cache.set.side_effect = Exception("cache down")
        mock_get_state.return_value = _run_state()

        assert (
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=560, caller="mention"
            )
            is not None
        )

    @patch(f"{MODULE_PATH}.cache")
    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_negative_is_written_with_the_configured_ttl(
        self, mock_get_state: MagicMock, mock_cache: MagicMock
    ) -> None:
        mock_cache.get.return_value = None
        mock_get_state.return_value = None

        with override_options({NO_RUN_CACHE_TTL_OPTION: 3600}):
            get_run_state_for_pr_id(
                organization_id=self.organization.id, provider=GITHUB, pr_id=561, caller="mention"
            )

        key, _value, ttl = mock_cache.set.call_args.args
        assert ttl == 3600
        assert str(self.organization.id) in key
        assert "561" in key

    @patch(f"{MODULE_PATH}.cache")
    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_zero_ttl_remembers_nothing_and_reads_nothing(
        self, mock_get_state: MagicMock, mock_cache: MagicMock
    ) -> None:
        """The off switch: every lookup asks Seer, so a late-arriving run is seen."""
        mock_get_state.return_value = None

        with override_options({NO_RUN_CACHE_TTL_OPTION: 0}):
            for _ in range(2):
                assert (
                    get_run_state_for_pr_id(
                        organization_id=self.organization.id,
                        provider=GITHUB,
                        pr_id=565,
                        caller="mention",
                    )
                    is None
                )

        assert mock_get_state.call_count == 2
        mock_cache.get.assert_not_called()
        mock_cache.set.assert_not_called()

    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_zero_ttl_sees_a_run_that_appears_after_a_negative(
        self, mock_get_state: MagicMock
    ) -> None:
        """What the long TTL trades away, and what turning it off buys back."""
        mock_get_state.return_value = None

        with override_options({NO_RUN_CACHE_TTL_OPTION: 0}):
            assert (
                get_run_state_for_pr_id(
                    organization_id=self.organization.id,
                    provider=GITHUB,
                    pr_id=566,
                    caller="mention",
                )
                is None
            )

            mock_get_state.return_value = _run_state()
            assert (
                get_run_state_for_pr_id(
                    organization_id=self.organization.id,
                    provider=GITHUB,
                    pr_id=566,
                    caller="mention",
                )
                is not None
            )

    @patch(f"{MODULE_PATH}.metrics.incr")
    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_cached_negative_is_counted_apart_from_a_fresh_one(
        self, mock_get_state: MagicMock, mock_incr: MagicMock
    ) -> None:
        mock_get_state.return_value = None

        get_run_state_for_pr_id(
            organization_id=self.organization.id, provider=GITHUB, pr_id=562, caller="mention"
        )
        get_run_state_for_pr_id(
            organization_id=self.organization.id, provider=GITHUB, pr_id=562, caller="mention"
        )

        # `metrics` is the shared module object, so filter to this module's key.
        lookups = [c for c in mock_incr.call_args_list if c.args[:1] == (f"{METRICS_KEY}.lookup",)]
        assert [c.kwargs["tags"]["result"] for c in lookups] == ["no_run", "cached_missing"]
        assert {c.kwargs["tags"]["caller"] for c in lookups} == {"mention"}

    @patch(f"{MODULE_PATH}.metrics.incr")
    @patch(f"{MODULE_PATH}.get_agent_state_from_pr_id")
    def test_the_caller_tag_distinguishes_the_listeners(
        self, mock_get_state: MagicMock, mock_incr: MagicMock
    ) -> None:
        """Without this the three paths' hit rates sum into one unreadable number."""
        mock_get_state.return_value = _run_state()

        get_run_state_for_pr_id(
            organization_id=self.organization.id, provider=GITHUB, pr_id=563, caller="review"
        )
        get_run_state_for_pr_id(
            organization_id=self.organization.id, provider=GITHUB, pr_id=564, caller="check_suite"
        )

        lookups = [c for c in mock_incr.call_args_list if c.args[:1] == (f"{METRICS_KEY}.lookup",)]
        assert [c.kwargs["tags"]["caller"] for c in lookups] == ["review", "check_suite"]
