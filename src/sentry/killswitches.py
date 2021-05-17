"""
Very simple "user partitioning" system used to shed load quickly from ingestion
pipeline if things go wrong. Allows for conditions based on project ID, event
type and organization ID.

This is similar to existing featureflagging systems we have, but with less
features and more performant.
"""

import copy
from collections import namedtuple
from typing import Any, Dict, List, Union

from sentry import options
from sentry.utils import metrics

Condition = Dict[str, str]
KillswitchConfig = List[Condition]
LegacyKillswitchConfig = Union[KillswitchConfig, List[int]]
Context = Dict[str, Any]

KillswitchInfo = namedtuple("KillswitchInfo", ["description", "fields"])

ALL_KILLSWITCH_OPTIONS = {
    "store.load-shed-group-creation-projects": KillswitchInfo(
        description="Drop event in save_event before entering transaction to create group",
        fields=("project_id", "platform"),
    ),
    "store.load-shed-pipeline-projects": KillswitchInfo(
        description="Drop event in ingest consumer. Available fields are severely restricted because nothing is parsed yet.",
        fields=("project_id", "event_id", "has_attachments"),
    ),
    "store.load-shed-parsed-pipeline-projects": KillswitchInfo(
        description="Drop events in ingest consumer after parsing them. Available fields are more but a bunch of stuff can go wrong before that.",
        fields=("organization_id", "project_id", "event_type", "has_attachments", "event_id"),
    ),
    "store.load-shed-process-event-projects": KillswitchInfo(
        description="Drop events in process_event.",
        fields=("project_id", "event_id", "platform"),
    ),
    "store.load-shed-symbolicate-event-projects": KillswitchInfo(
        description="Drop events in symbolicate_event.",
        fields=("project_id", "event_id", "platform"),
    ),
}


def validate_user_input(killswitch_name: str, option_value: Any) -> KillswitchConfig:
    for condition in option_value:
        valid_options = set(ALL_KILLSWITCH_OPTIONS[killswitch_name].fields)
        used_options = set(condition)
        if valid_options - used_options:
            raise ValueError(f"Missing fields: {valid_options - used_options}")

        if used_options - valid_options:
            raise ValueError(f"Unknown fields: {used_options - valid_options}")

    return normalize_value(option_value)


def normalize_value(option_value: Any) -> KillswitchConfig:
    rv = []
    for condition in option_value:
        if not condition:
            continue
        elif isinstance(condition, int):
            rv.append({"project_id": str(condition)})
        elif isinstance(condition, dict):
            condition = {k: str(v) for k, v in condition.items() if v is not None}
            if condition:
                rv.append(condition)

    return rv


def killswitch_matches_context(option_key: str, context: Context) -> bool:
    assert option_key in ALL_KILLSWITCH_OPTIONS
    assert set(ALL_KILLSWITCH_OPTIONS[option_key].fields) == set(context)
    option_value = options.get(option_key)
    rv = _value_matches(option_value, context)
    metrics.incr(
        "sentry.killswitches.run",
        tags={"option_key": option_key, "decision": "matched" if rv else "passed"},
    )

    return rv


def _value_matches(raw_option_value: LegacyKillswitchConfig, context: Context) -> bool:
    option_value = normalize_value(raw_option_value)

    for condition in option_value:
        for field, matching_value in condition.items():
            value = context.get(field)
            if value is None:
                break

            if str(value) != matching_value:
                break
        else:
            return True

    return False


def print_conditions(raw_option_value: LegacyKillswitchConfig) -> str:
    option_value = normalize_value(raw_option_value)

    if not option_value:
        return "<disabled entirely>"

    return "DROP DATA WHERE\n  " + " OR\n  ".join(
        "("
        + " AND ".join(f"{field} = {matching_value}" for field, matching_value in condition.items())
        + ")"
        for condition in option_value
    )


def add_condition(
    raw_option_value: LegacyKillswitchConfig, condition: Condition
) -> KillswitchConfig:
    option_value = copy.deepcopy(normalize_value(raw_option_value))
    option_value.append(condition)
    return normalize_value(option_value)


def remove_condition(
    raw_option_value: LegacyKillswitchConfig, condition: Condition
) -> KillswitchConfig:
    option_value = copy.deepcopy(normalize_value(raw_option_value))
    option_value = [m for m in option_value if m != condition]
    return normalize_value(option_value)
