from __future__ import annotations

from collections.abc import Iterable, Mapping
from hashlib import md5
from re import Match
from typing import TYPE_CHECKING, Any
from uuid import UUID

from django.utils.encoding import force_bytes

from sentry.db.models.fields.node import NodeData
from sentry.grouping.fingerprinting.utils import (
    DEFAULT_FINGERPRINT_VARIABLE,
    _fingerprint_var_re,
    parse_fingerprint_entry_as_variable,
    resolve_fingerprint_variable,
)

if TYPE_CHECKING:
    from sentry.grouping.component import ExceptionGroupingComponent


def hash_from_values(values: Iterable[str | int | UUID | ExceptionGroupingComponent]) -> str:
    """
    Primarily used at the end of the grouping process, to get a final hash value once the all of the
    variants have been constructed, but also used as a hack to compare exception components (by
    stringifying their reprs) when calculating variants for chained exceptions.
    """
    result = md5()
    for value in values:
        result.update(force_bytes(value, errors="replace"))
    return result.hexdigest()


def bool_from_string(value: str) -> bool | None:
    """
    Convert various string representations of boolean values ("1", "yes", "true", "0", "no",
    "false") into actual booleans. Return `None` for all other inputs.
    """
    if value:
        value = value.lower()
        if value in ("1", "yes", "true"):
            return True
        elif value in ("0", "no", "false"):
            return False

    return None


def resolve_fingerprint_values(
    fingerprint: list[str], event_data: NodeData, use_legacy_unknown_variable_handling: bool = False
) -> list[str]:
    def _resolve_single_entry(entry: str) -> str:
        variable_key = parse_fingerprint_entry_as_variable(entry)
        if variable_key == "default":  # entry is some variation of `{{ default }}`
            return DEFAULT_FINGERPRINT_VARIABLE
        if variable_key is None:  # entry isn't a variable
            return entry

        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove `use_legacy_unknown_variable_handling` and just return the value given by
        # `resolve_fingerprint_variable`
        resolved_value = resolve_fingerprint_variable(
            variable_key, event_data, use_legacy_unknown_variable_handling
        )

        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove this
        if resolved_value is None:  # variable wasn't recognized
            return entry
        return resolved_value

    return [_resolve_single_entry(entry) for entry in fingerprint]


def expand_title_template(
    template: str, event_data: Mapping[str, Any], use_legacy_unknown_variable_handling: bool = False
) -> str:
    def _handle_match(match: Match[str]) -> str:
        variable_key = match.group(1)
        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove `use_legacy_unknown_variable_handling` and just return the value given by
        # `resolve_fingerprint_variable`
        resolved_value = resolve_fingerprint_variable(
            variable_key, event_data, use_legacy_unknown_variable_handling
        )

        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove this
        if resolved_value is not None:
            return resolved_value
        # If the variable can't be resolved, return it as is
        return match.group(0)

    return _fingerprint_var_re.sub(_handle_match, template)
