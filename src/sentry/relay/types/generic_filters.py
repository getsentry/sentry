from collections.abc import Sequence
from typing import TypedDict

from .rule_condition import RuleCondition


class GenericFilter(TypedDict):
    """Configuration for a generic filter that filters incoming events."""

    id: str
    isEnabled: bool
    condition: RuleCondition


class GenericFiltersConfig(TypedDict):
    """Top-level configuration for generic filters."""

    version: int
    filters: Sequence[GenericFilter]
