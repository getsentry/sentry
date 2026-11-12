"""Withholding declared choice values from a serializer's generated schema.

drf-spectacular drops whole fields itself. This removes single choices from the
schema of exactly the serializer declaring them, then checks nothing else moved.
"""

from __future__ import annotations

import copy
from collections.abc import Iterator, Mapping, Set
from typing import Any

from drf_spectacular.drainage import get_override

from sentry.apidocs.omission_paths import VALUE, PathError, Resolved, resolve
from sentry.apidocs.omissions import OMISSION_REASONS_OVERRIDE

_ABSENT = object()


class OmissionError(Exception):
    """A declaration that cannot be applied to the generated schema exactly."""


def choice_rules(serializer: Any) -> dict[str, Resolved]:
    """The ``field.choice`` paths `serializer` declares, resolved against its fields."""
    declared = get_override(serializer, OMISSION_REASONS_OVERRIDE, {}) or {}
    rules: dict[str, Resolved] = {}
    errors: list[str] = []
    for path in sorted(path for path in declared if "." in path):
        try:
            resolved = resolve(serializer, path)
        except PathError as exc:
            errors.append(str(exc))
            continue
        if resolved.kind != VALUE:
            errors.append(f"{path!r} does not name a choice value")
            continue
        rules[path] = resolved
    if errors:
        raise OmissionError(f"{type(serializer).__name__}: {'; '.join(errors)}")
    return rules


def withhold_values(schema: Mapping[str, Any], rules: Mapping[str, Resolved]) -> dict[str, Any]:
    """A copy of a serializer's mapped schema with each rule's choice removed."""
    result = copy.deepcopy(dict(schema))
    properties = result.get("properties")
    for path, rule in rules.items():
        field, value = rule.segments
        if not isinstance(properties, dict) or not isinstance(properties.get(field), dict):
            raise OmissionError(f"{path!r}: {field!r} is not in the generated schema")
        prop = properties[field]
        holder = _enum_holder(prop, path)
        if value not in {str(entry) for entry in holder["enum"]}:
            raise OmissionError(f"{path!r}: {value!r} is not in the generated enum")
        holder["enum"] = [entry for entry in holder["enum"] if str(entry) != value]
        strip_choice_description(prop, value)
        strip_choice_description(holder, value)
        if rule.withholds_default:
            # A default only means anything for an optional field.
            prop.pop("default", None)
            holder.pop("default", None)
            result["required"] = sorted({*result.get("required", []), field})
    return result


def _enum_holder(prop: dict[str, Any], path: str) -> dict[str, Any]:
    """The schema carrying the enum, which for a list sits on its items."""
    for candidate in (prop, prop.get("items")):
        if isinstance(candidate, dict) and isinstance(candidate.get("enum"), list):
            return candidate
    raise OmissionError(f"{path!r}: the generated schema has no enum to withhold from")


def strip_choice_description(holder: Any, value: str) -> None:
    """Drop a withheld value from the generated choice listing.

    Every choice is named in the description, so the enum alone is not enough."""
    if not isinstance(holder, dict):
        return
    description = holder.get("description")
    if not isinstance(description, str):
        return
    kept = [line for line in description.splitlines() if not line.startswith(f"* `{value}`")]
    while kept and not kept[-1].strip():
        kept.pop()
    holder["description"] = "\n".join(kept)
    if not holder["description"]:
        del holder["description"]


def check_withheld_values(
    before: Mapping[str, Any], after: Mapping[str, Any], rules: Mapping[str, Resolved]
) -> None:
    """Raise unless `after` differs from `before` only where `rules` allow.

    Written apart from withhold_values, so a mistake there cannot also pass here."""
    withheld: dict[str, set[str]] = {}
    defaults: set[str] = set()
    for rule in rules.values():
        field, value = rule.segments
        withheld.setdefault(field, set()).add(value)
        if rule.withholds_default:
            defaults.add(field)
    for key, old, new in _differences(before, after):
        if not _allowed(key, old, new, withheld, defaults):
            raise OmissionError(
                f"withholding {sorted(rules)} changed {'/'.join(key)} from {_shown(old)} to "
                f"{_shown(new)}, which no declaration covers"
            )


def check_required_parameters(
    before: Mapping[tuple[str, str], Any],
    after: Mapping[tuple[str, str], Any],
    required: Set[tuple[str, str]],
) -> None:
    """Raise unless `after` marks exactly the `required` parameters and changes
    nothing else. Parameters are keyed by (name, location)."""
    for key in sorted({*before, *after}):
        old, new = before.get(key, _ABSENT), after.get(key, _ABSENT)
        label = f"{key[1]}:{key[0]}"
        if key in required:
            expected = {**old, "required": True} if isinstance(old, Mapping) else old
            if new != expected:
                raise OmissionError(
                    f"withholding the default of {label} should only mark it required, but it "
                    f"changed from {_shown(old)} to {_shown(new)}"
                )
        elif new != old:
            raise OmissionError(
                f"{label} changed from {_shown(old)} to {_shown(new)}, which no withheld "
                f"default covers"
            )


def _differences(
    old: Any, new: Any, key: tuple[str, ...] = ()
) -> Iterator[tuple[tuple[str, ...], Any, Any]]:
    """Every differing leaf, keyed by the property names leading to it."""
    if isinstance(old, Mapping) and isinstance(new, Mapping):
        for name in sorted({*old, *new}, key=str):
            yield from _differences(
                old.get(name, _ABSENT), new.get(name, _ABSENT), (*key, str(name))
            )
    elif (
        isinstance(old, list)
        and isinstance(new, list)
        and key[-1:] in (("anyOf",), ("oneOf",), ("allOf",))
        and len(old) == len(new)
    ):
        # Union arms are compared one by one, so a change inside one can be placed.
        for index, (old_arm, new_arm) in enumerate(zip(old, new)):
            yield from _differences(old_arm, new_arm, (*key, str(index)))
    elif old != new:
        yield key, old, new


def _allowed(
    key: tuple[str, ...],
    old: Any,
    new: Any,
    withheld: Mapping[str, Set[str]],
    defaults: Set[str],
) -> bool:
    if key == ("required",):
        previous = old if isinstance(old, list) else []
        return isinstance(new, list) and set(new) == {*previous, *defaults}
    if len(key) < 3 or key[0] != "properties" or key[1] not in withheld:
        return False
    field, rest = key[1], key[2:]
    if rest[:1] == ("items",):
        rest = rest[1:]
    if rest == ("enum",):
        return isinstance(old, list) and new == [e for e in old if str(e) not in withheld[field]]
    if rest == ("description",):
        return isinstance(old, str) and new == _without_choice_lines(old, withheld[field])
    if rest == ("default",):
        return field in defaults and new is _ABSENT
    return False


def _without_choice_lines(description: str, values: Set[str]) -> Any:
    lines = [
        line
        for line in description.splitlines()
        if not any(line.startswith(f"* `{value}`") for value in values)
    ]
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines) if lines else _ABSENT


def _shown(value: Any) -> str:
    return "<absent>" if value is _ABSENT else repr(value)
