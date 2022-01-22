from collections import namedtuple

RuleFuture = namedtuple("RuleFuture", ["rule", "kwargs"])

from .base import EventState, RuleBase, RuleDescriptor
from .match import LEVEL_MATCH_CHOICES, MATCH_CHOICES, MatchType
from .registry import RuleRegistry

__all__ = (
    "EventState",
    "init_registry",
    "LEVEL_MATCH_CHOICES",
    "MATCH_CHOICES",
    "MatchType",
    "RuleBase",
    "RuleDescriptor",
    "RuleFuture",
    "rules",
)


def init_registry() -> RuleRegistry:
    from sentry.constants import _SENTRY_RULES
    from sentry.plugins.base import plugins
    from sentry.utils.imports import import_string
    from sentry.utils.safe import safe_execute

    registry = RuleRegistry()
    for rule in _SENTRY_RULES:
        cls = import_string(rule)
        registry.add(cls)
    for plugin in plugins.all(version=2):
        for cls in safe_execute(plugin.get_rules, _with_transaction=False) or ():
            registry.add(cls)

    return registry


rules = init_registry()
