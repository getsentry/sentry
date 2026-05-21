from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any


def _qualify(prefix: str, name: str) -> str:
    return f"{prefix}.{name}" if prefix else name


def describe_value(value: Any) -> str:
    """PII-safe value descriptor for production logging."""
    if value is None:
        return "None"
    if isinstance(value, str):
        return f"str(len={len(value)})"
    if isinstance(value, bool):
        return f"bool({value})"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, list):
        return f"list(len={len(value)})"
    if isinstance(value, dict):
        return f"dict(keys={sorted(value.keys())})"
    return type(value).__name__


@dataclass
class ParityChecker:
    """Recursive dict comparator with dot-separated field paths.

    ``format_value`` controls how values appear in mismatch messages.
    Use ``repr`` (default) for test output with full values, or
    ``describe_value`` for PII-safe structural metadata in production.
    """

    format_value: Callable[[Any], str] = repr
    mismatches: list[str] = field(default_factory=list)

    # known_diffs entries confirmed to be actual differences.
    confirmed: set[str] = field(default_factory=set)

    def _nested_fields(self, field_set: frozenset[str], key: str) -> frozenset[str]:
        """Extract child paths for *key* from a dot-separated field set.

        E.g. ``_nested_fields({"activities.id", "title"}, "activities")``
        returns ``{"id"}``.
        """
        prefix = key + "."
        return frozenset(e[len(prefix) :] for e in field_set if e.startswith(prefix))

    def compare(
        self,
        old: Mapping[str, Any],
        new: Mapping[str, Any],
        known_diffs: frozenset[str],
        path: str = "",
        diffs_path: str = "",
        *,
        unreliable: frozenset[str] = frozenset(),
    ) -> None:
        for key in set(list(old.keys()) + list(new.keys())):
            if key in known_diffs:
                full_diffs_key = _qualify(diffs_path, key)
                if key not in new or key not in old or old[key] != new[key]:
                    self.confirmed.add(full_diffs_key)
                continue

            if key in unreliable:
                full_path = _qualify(path, key)
                if key not in new:
                    self.mismatches.append(f"Missing from new: {full_path}")
                elif key not in old:
                    self.mismatches.append(f"Extra in new: {full_path}")
                continue

            full_path = _qualify(path, key)

            if key not in new:
                self.mismatches.append(f"Missing from new: {full_path}")
                continue
            if key not in old:
                self.mismatches.append(f"Extra in new: {full_path}")
                continue

            old_val = old[key]
            new_val = new[key]
            nested_diffs = self._nested_fields(known_diffs, key)
            nested_unreliable = self._nested_fields(unreliable, key)

            if nested_diffs or nested_unreliable:
                child_diffs_path = _qualify(diffs_path, key)
                if isinstance(old_val, list) and isinstance(new_val, list):
                    if len(old_val) != len(new_val):
                        self.mismatches.append(
                            f"{full_path} count: old={len(old_val)}, new={len(new_val)}"
                        )
                    for i, (old_item, new_item) in enumerate(zip(old_val, new_val)):
                        item_path = f"{full_path}[{i}]"
                        if isinstance(old_item, Mapping) and isinstance(new_item, Mapping):
                            self.compare(
                                old_item,
                                new_item,
                                nested_diffs,
                                item_path,
                                child_diffs_path,
                                unreliable=nested_unreliable,
                            )
                        elif old_item != new_item:
                            self.mismatches.append(
                                f"{item_path}: old={self.format_value(old_item)}, new={self.format_value(new_item)}"
                            )
                elif isinstance(old_val, Mapping) and isinstance(new_val, Mapping):
                    self.compare(
                        old_val,
                        new_val,
                        nested_diffs,
                        full_path,
                        child_diffs_path,
                        unreliable=nested_unreliable,
                    )
                elif old_val != new_val:
                    self.mismatches.append(
                        f"{full_path}: old={self.format_value(old_val)}, new={self.format_value(new_val)}"
                    )
            elif old_val != new_val:
                self.mismatches.append(
                    f"{full_path}: old={self.format_value(old_val)}, new={self.format_value(new_val)}"
                )
