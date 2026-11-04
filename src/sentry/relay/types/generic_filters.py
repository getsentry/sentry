from collections.abc import Sequence
from typing import TypedDict

from .rule_condition import RuleCondition


class GenericFilter(TypedDict):
    """Configuration for a generic filter that filters incoming events.

    Project configs may reference a filter defined in global config by ID and
    leave its condition null. Relay combines the project toggle with the global
    condition.
    """

    id: str
    isEnabled: bool
    condition: RuleCondition | None


class GenericFiltersConfig(TypedDict):
    """Top-level configuration for generic filters."""

    version: int
    filters: Sequence[GenericFilter]
