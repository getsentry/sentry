from sentry.tasks.seer.night_shift.simple_triage import _agentic_triage_score
from sentry.testutils.cases import TestCase


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
