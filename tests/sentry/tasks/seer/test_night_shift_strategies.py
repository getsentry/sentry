from sentry.tasks.seer.night_shift.strategies import (
    DEFAULT_TRIAGE_STRATEGY,
    TRIAGE_STRATEGIES,
    resolve_triage_strategy,
)
from sentry.testutils.cases import TestCase


class ResolveTriageStrategyTest(TestCase):
    def test_override_wins(self) -> None:
        name, fn = resolve_triage_strategy("agentic_triage")
        assert name == "agentic_triage"
        assert fn is TRIAGE_STRATEGIES["agentic_triage"]

    def test_no_override_uses_default(self) -> None:
        name, fn = resolve_triage_strategy(None)
        assert name == DEFAULT_TRIAGE_STRATEGY
        assert fn is TRIAGE_STRATEGIES[DEFAULT_TRIAGE_STRATEGY]

    def test_falls_back_on_unknown_override(self) -> None:
        name, fn = resolve_triage_strategy("bogus_override")
        assert name == DEFAULT_TRIAGE_STRATEGY
        assert fn is TRIAGE_STRATEGIES[DEFAULT_TRIAGE_STRATEGY]
