"""
Very simple "user partitioning" system used to shed load quickly from ingestion
pipeline if things go wrong. Allows for conditions based on project ID, event
type and organization ID.

This is similar to existing featureflagging systems we have, but with less
features and more performant.
"""

import copy
from typing import Any, Dict, List

from sentry import options

KillswitchValue = Dict[str, List[str]]
Context = Dict[str, Any]

ALL_KILLSWITCH_OPTIONS = [
    "store.load-shed-group-creation-projects",
    "store.load-shed-pipeline-projects",
]


def _normalize_value(option_value: Any) -> KillswitchValue:
    if isinstance(option_value, list):
        if not option_value:
            return {}

        return {"project_id": [str(x) for x in option_value]}

    if isinstance(option_value, dict):
        return {k: v for k, v in option_value.items() if v and isinstance(v, list)}

    return {}


def killswitch_matches_context(option_key: str, context: Context) -> bool:
    assert option_key in ALL_KILLSWITCH_OPTIONS
    option_value = options.get(option_key)
    return _value_matches(option_value, context)


def _value_matches(option_value: Any, context: Context) -> bool:
    option_value = _normalize_value(option_value)

    if not option_value:
        return False

    for field, matching_values in option_value.items():

        value = context.get(field)
        if value is None:
            return False

        if str(value) not in matching_values:
            return False

    return True


def print_conditions(option_value: Any) -> str:
    option_value = _normalize_value(option_value)

    if not option_value:
        return "<disabled entirely>"

    return "DROP DATA WHERE\n  " + " AND\n  ".join(f"{k} IN {v}" for k, v in option_value.items())


def add_condition(option_value: Any, context_field: str, context_value: str) -> KillswitchValue:
    option_value = copy.deepcopy(_normalize_value(option_value))
    option_value.setdefault(context_field, []).append(context_value)
    return _normalize_value(option_value)


def remove_condition(option_value: Any, context_field: str, context_value: str) -> KillswitchValue:
    option_value = copy.deepcopy(_normalize_value(option_value))
    if context_field in option_value:
        option_value[context_field] = [x for x in option_value[context_field] if x != context_value]
    return _normalize_value(option_value)
