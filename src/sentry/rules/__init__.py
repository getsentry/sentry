from .base import EventState, RuleBase
from .match import LEVEL_MATCH_CHOICES, MATCH_CHOICES, MatchType, match_values
from .registry import RuleRegistry

__all__ = (
    "EventState",
    "init_registry",
    "LEVEL_MATCH_CHOICES",
    "MATCH_CHOICES",
    "MatchType",
    "RuleBase",
    "rules",
    "match_values",
)


def init_registry() -> RuleRegistry:
    from sentry.constants import _SENTRY_RULES
    from sentry.utils.imports import import_string

    registry = RuleRegistry()
    for rule in _SENTRY_RULES:
        cls = import_string(rule)
        registry.add(cls)

    return registry


rules = init_registry()
