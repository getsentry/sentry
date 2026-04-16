from unittest.mock import patch

from sentry.tasks.seer.night_shift.strategies import (
    DEFAULT_TRIAGE_STRATEGY,
    TRIAGE_STRATEGIES,
    resolve_triage_strategy,
)
from sentry.testutils.cases import TestCase


class ResolveTriageStrategyTest(TestCase):
    def test_override_wins(self) -> None:
        with self.options({"seer.night_shift.default_strategy": "agentic_triage"}):
            name, fn = resolve_triage_strategy("agentic_triage")
            assert name == "agentic_triage"
            assert fn is TRIAGE_STRATEGIES["agentic_triage"]

    def test_uses_option_when_no_override(self) -> None:
        fake = lambda projects, organization, max_candidates: ([], None)
        with (
            patch.dict(TRIAGE_STRATEGIES, {"fake_v2": fake}),
            self.options({"seer.night_shift.default_strategy": "fake_v2"}),
        ):
            name, resolved = resolve_triage_strategy(None)
            assert name == "fake_v2"
            assert resolved is fake

    def test_falls_back_on_unknown_name(self) -> None:
        with self.options({"seer.night_shift.default_strategy": "does_not_exist"}):
            name, fn = resolve_triage_strategy(None)
            assert name == DEFAULT_TRIAGE_STRATEGY
            assert fn is TRIAGE_STRATEGIES[DEFAULT_TRIAGE_STRATEGY]

    def test_falls_back_on_unknown_override(self) -> None:
        name, fn = resolve_triage_strategy("bogus_override")
        assert name == DEFAULT_TRIAGE_STRATEGY
        assert fn is TRIAGE_STRATEGIES[DEFAULT_TRIAGE_STRATEGY]
