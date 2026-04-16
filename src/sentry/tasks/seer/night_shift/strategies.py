from __future__ import annotations

import logging
from collections.abc import Callable, Sequence

from sentry import options
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.seer.night_shift.agentic_triage import agentic_triage_strategy
from sentry.tasks.seer.night_shift.models import TriageResult

logger = logging.getLogger("sentry.tasks.seer.night_shift")

TriageStrategyFn = Callable[
    [Sequence[Project], Organization, int],
    tuple[list[TriageResult], int | None],
]

TRIAGE_STRATEGIES: dict[str, TriageStrategyFn] = {
    "agentic_triage": agentic_triage_strategy,
}

DEFAULT_TRIAGE_STRATEGY = "agentic_triage"


def resolve_triage_strategy(override: str | None) -> tuple[str, TriageStrategyFn]:
    """
    Resolve a strategy name using: explicit override -> options -> constant default.
    If the resolved name isn't in the registry, log and fall back to the default.
    """
    name = override or options.get("seer.night_shift.default_strategy") or DEFAULT_TRIAGE_STRATEGY
    fn = TRIAGE_STRATEGIES.get(name)
    if fn is None:
        logger.warning(
            "night_shift.unknown_strategy",
            extra={"requested": name, "fallback": DEFAULT_TRIAGE_STRATEGY},
        )
        name = DEFAULT_TRIAGE_STRATEGY
        fn = TRIAGE_STRATEGIES[DEFAULT_TRIAGE_STRATEGY]
    return name, fn
