from collections.abc import Callable, Sequence
from unittest.mock import patch

import pytest

from sentry.models.grouplink import GroupLink
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.tasks.seer.agentic_triage.simple_triage import (
    ScoredCandidate,
    _agentic_triage_score,
    fixability_score_strategy,
    fixability_score_strategy_per_project,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
@pytest.mark.parametrize("state", [None, *PullRequestLifecycleState.values])
@pytest.mark.parametrize(
    "strategy", [fixability_score_strategy, fixability_score_strategy_per_project]
)
def test_excludes_prior_seer_pull_requests_after_cooldown(
    default_project: Project,
    state: str | None,
    strategy: Callable[[Sequence[Project], int], list[ScoredCandidate]],
) -> None:
    linked = Factories.create_group(
        project=default_project,
        seer_explorer_autofix_last_triggered=before_now(days=31),
        last_seen=before_now(minutes=1),
    )
    retry = Factories.create_group(
        project=default_project,
        seer_explorer_autofix_last_triggered=before_now(days=45),
        last_seen=before_now(minutes=2),
    )
    fresh = Factories.create_group(project=default_project, last_seen=before_now(minutes=3))
    Factories.create_group(
        project=default_project, seer_explorer_autofix_last_triggered=before_now(days=1)
    )
    repository = Factories.create_repo(project=default_project)
    pull_request = Factories.create_pull_request(
        repository_id=repository.id, organization_id=default_project.organization_id
    )
    pull_request.update(state=state, date_added=before_now(days=45))
    prior_run = Factories.create_seer_run(
        organization=default_project.organization, last_triggered_at=before_now(days=45)
    )
    Factories.create_seer_agent_run(
        run=prior_run,
        project=default_project,
        group=linked,
        source="autofix",
    )
    Factories.create_seer_run_pull_request(run=prior_run, pull_request=pull_request)
    # A newer run without a PR must not hide an earlier run's PR.
    newer_run = Factories.create_seer_run(
        organization=default_project.organization, last_triggered_at=before_now(days=31)
    )
    Factories.create_seer_agent_run(
        run=newer_run, project=default_project, group=linked, source="autofix"
    )
    no_pr_run = Factories.create_seer_run(
        organization=default_project.organization, last_triggered_at=before_now(days=45)
    )
    Factories.create_seer_agent_run(
        run=no_pr_run, project=default_project, group=retry, source="autofix"
    )

    with (
        patch(
            "sentry.tasks.seer.agentic_triage.simple_triage._agentic_triage_snuba_factors",
            return_value={},
        ),
        patch("sentry.tasks.seer.agentic_triage.simple_triage.AGENTIC_TRIAGE_ISSUE_FETCH_LIMIT", 2),
        patch("sentry.tasks.seer.agentic_triage.simple_triage.AGENTIC_TRIAGE_MAX_SEARCH_PAGES", 1),
    ):
        candidates = strategy([default_project], 10)

    assert {candidate.group.id for candidate in candidates} == {retry.id, fresh.id}


@django_db_all
@pytest.mark.parametrize(
    "relationship", [GroupLink.Relationship.references, GroupLink.Relationship.resolves]
)
def test_group_pr_links_do_not_exclude_candidates(
    default_project: Project, relationship: int
) -> None:
    group = Factories.create_group(project=default_project)
    other_group = Factories.create_group(project=default_project, seer_fixability_score=0.0)
    repository = Factories.create_repo(project=default_project)
    pull_request = Factories.create_pull_request(
        repository_id=repository.id, organization_id=default_project.organization_id
    )
    Factories.create_group_link(
        group=group,
        linked_id=pull_request.id,
        linked_type=GroupLink.LinkedType.pull_request,
        relationship=relationship,
    )
    other_pull_request = Factories.create_pull_request(
        repository_id=repository.id, organization_id=default_project.organization_id
    )
    other_run = Factories.create_seer_run(organization=default_project.organization)
    Factories.create_seer_agent_run(
        run=other_run, project=default_project, group=other_group, source="autofix"
    )
    Factories.create_seer_run_pull_request(run=other_run, pull_request=other_pull_request)

    with patch(
        "sentry.tasks.seer.agentic_triage.simple_triage._agentic_triage_snuba_factors",
        return_value={},
    ):
        candidates = fixability_score_strategy([default_project], 10)

    assert [candidate.group.id for candidate in candidates] == [group.id]


class TestAgenticTriageScore(TestCase):
    """Tests for _agentic_triage_score — min-max normalization and weighted sum."""

    def test_varying_values(self):
        """Candidates with different factor values get different scores."""
        factors = {
            1: {"max_timestamp": 100.0, "max_level": 3, "unique_users": 10, "event_count": 500},
            2: {"max_timestamp": 200.0, "max_level": 1, "unique_users": 50, "event_count": 5},
            3: {"max_timestamp": 300.0, "max_level": 4, "unique_users": 1, "event_count": 50},
        }
        scores = _agentic_triage_score([1, 2, 3], factors)

        # All scores should be between 0 and 1 (4 factors × 0.25 max each).
        for gid in [1, 2, 3]:
            assert 0.0 <= scores[gid] <= 1.0

        # Group 3 has highest recency and severity, should score well.
        # Group 2 has most users. Group 1 has most events.
        # No single group dominates all factors, so scores should differ.
        assert len(set(scores.values())) == 3

    def test_all_identical(self):
        """When all candidates have the same values, all scores are 0."""
        factors = {
            1: {"max_timestamp": 100.0, "max_level": 3, "unique_users": 10, "event_count": 50},
            2: {"max_timestamp": 100.0, "max_level": 3, "unique_users": 10, "event_count": 50},
        }
        scores = _agentic_triage_score([1, 2], factors)
        assert scores[1] == 0.0
        assert scores[2] == 0.0

    def test_single_candidate(self):
        """A single candidate gets score 0 (min == max for all factors)."""
        factors = {
            1: {"max_timestamp": 100.0, "max_level": 3, "unique_users": 10, "event_count": 50},
        }
        scores = _agentic_triage_score([1], factors)
        assert scores[1] == 0.0

    def test_missing_group_in_snuba(self):
        """A group not returned by Snuba gets 0 for all factors."""
        factors = {
            1: {"max_timestamp": 200.0, "max_level": 4, "unique_users": 100, "event_count": 500},
        }
        scores = _agentic_triage_score([1, 2], factors)
        # Group 1 has max values, group 2 has 0 — group 1 should score higher.
        assert scores[1] > scores[2]
        assert scores[2] == 0.0

    def test_zero_weight_factor_skipped(self):
        """Factors with weight=0 are excluded from the score."""
        factors = {
            1: {"max_timestamp": 100.0, "max_level": 3, "unique_users": 999, "event_count": 50},
            2: {"max_timestamp": 200.0, "max_level": 3, "unique_users": 1, "event_count": 50},
        }
        # Zero out user-impact weight — unique_users difference shouldn't matter.
        with self.options({"snuba.search.agentic-triage.user-impact-weight": 0}):
            scores = _agentic_triage_score([1, 2], factors)

        # Only recency differs (severity and volume are identical).
        # Group 2 has higher recency so it should score higher.
        assert scores[2] > scores[1]

    def test_empty_inputs(self):
        """Empty group_ids or factors returns all zeros."""
        assert _agentic_triage_score([], {}) == {}
        assert _agentic_triage_score([1, 2], {}) == {1: 0.0, 2: 0.0}
