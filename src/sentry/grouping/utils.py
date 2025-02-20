from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from hashlib import md5
from re import Match
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

from django.utils.encoding import force_bytes

from sentry.db.models.fields.node import NodeData
from sentry.stacktraces.processing import get_crash_frame_from_event_data
from sentry.utils.safe import get_path

if TYPE_CHECKING:
    from sentry.grouping.component import ExceptionGroupingComponent


_fingerprint_var_re = re.compile(r"\{\{\s*(\S+)\s*\}\}")
DEFAULT_FINGERPRINT_VARIABLE = "{{ default }}"


def parse_fingerprint_entry_as_variable(entry: str) -> str | None:
    """
    Determine if the given fingerprint entry is a variable, and if it is, return its key (that is,
    extract the variable name from a variable string of the form "{{ var_name }}"). If the given
    entry isn't the correct form to be a variable, return None.
    """
    match = _fingerprint_var_re.match(entry)
    if match is not None and match.end() == len(entry):
        return match.group(1)
    return None


def is_default_fingerprint_var(value: str) -> bool:
    return parse_fingerprint_entry_as_variable(value) == "default"


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


def get_fingerprint_type(
    fingerprint: list[str] | None,
) -> Literal["default", "hybrid", "custom"] | None:
    """
    Examine a fingerprint to determine if it's custom, hybrid, or the default fingerprint.

    Accepts (and then returns) None for convenience, so the fingerprint's existence doesn't have to
    be separately checked.
    """
    if not fingerprint:
        return None

    return (
        "default"
        if len(fingerprint) == 1 and is_default_fingerprint_var(fingerprint[0])
        else (
            "hybrid"
            if any(is_default_fingerprint_var(entry) for entry in fingerprint)
            else "custom"
        )
    )


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


def get_fingerprint_value(
    variable_key: str, event_data: NodeData | Mapping[str, Any]
) -> str | None:
    if variable_key == "transaction":
        return event_data.get("transaction") or "<no-transaction>"

    elif variable_key == "message":
        message = (
            get_path(event_data, "logentry", "formatted")
            or get_path(event_data, "logentry", "message")
            or get_path(event_data, "exception", "values", -1, "value")
        )
        return message or "<no-message>"

    elif variable_key in ("type", "error.type"):
        ty = get_path(event_data, "exception", "values", -1, "type")
        return ty or "<no-type>"

    elif variable_key in ("value", "error.value"):
        value = get_path(event_data, "exception", "values", -1, "value")
        return value or "<no-value>"

    elif variable_key in ("function", "stack.function"):
        frame = get_crash_frame_from_event_data(event_data)
        func = frame.get("function") if frame else None
        return func or "<no-function>"

    elif variable_key in ("path", "stack.abs_path"):
        frame = get_crash_frame_from_event_data(event_data)
        abs_path = frame.get("abs_path") or frame.get("filename") if frame else None
        return abs_path or "<no-abs-path>"

    elif variable_key == "stack.filename":
        frame = get_crash_frame_from_event_data(event_data)
        filename = frame.get("filename") or frame.get("abs_path") if frame else None
        return filename or "<no-filename>"

    elif variable_key in ("module", "stack.module"):
        frame = get_crash_frame_from_event_data(event_data)
        mod = frame.get("module") if frame else None
        return mod or "<no-module>"

    elif variable_key in ("package", "stack.package"):
        frame = get_crash_frame_from_event_data(event_data)
        pkg = frame.get("package") if frame else None
        if pkg:
            pkg = pkg.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        return pkg or "<no-package>"

    elif variable_key == "level":
        return event_data.get("level") or "<no-level>"

    elif variable_key == "logger":
        return event_data.get("logger") or "<no-logger>"

    elif variable_key.startswith("tags."):
        # Turn "tags.some_tag" into just "some_tag"
        tag = variable_key[5:]
        for tag_name, value in event_data.get("tags") or ():
            if tag_name == tag and value is not None:
                return value
        return "<no-value-for-tag-%s>" % tag
    else:
        return None


def resolve_fingerprint_values(fingerprint: list[str], event_data: NodeData) -> list[str]:
    def _resolve_single_entry(entry: str) -> str:
        variable_key = parse_fingerprint_entry_as_variable(entry)
        if variable_key == "default":
            return DEFAULT_FINGERPRINT_VARIABLE
        if variable_key is None:
            return entry
        resolved_value = get_fingerprint_value(variable_key, event_data)
        if resolved_value is None:
            return entry
        return resolved_value

    return [_resolve_single_entry(entry) for entry in fingerprint]


def expand_title_template(template: str, event_data: Mapping[str, Any]) -> str:
    def _handle_match(match: Match[str]) -> str:
        variable_key = match.group(1)
        resolved_value = get_fingerprint_value(variable_key, event_data)
        if resolved_value is not None:
            return resolved_value
        return match.group(0)

    return _fingerprint_var_re.sub(_handle_match, template)
