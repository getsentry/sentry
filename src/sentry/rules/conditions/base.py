from typing import TypedDict

from sentry.rules.base import RuleBase


class GenericCondition(TypedDict):
    # the ID in the rules registry that maps to a condition class
    # e.g. "sentry.rules.conditions.every_event.EveryEventCondition"
    id: str


class EventCondition(RuleBase):
    rule_type = "condition/event"
