from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


def assert_serializer_parity(
    *,
    old: Mapping[str, Any],
    new: Mapping[str, Any],
    known_differences: set[str] | None = None,
    unreliable: set[str] | None = None,
) -> None:
    """Assert that two serializer responses are equal, modulo known differences.

    ``known_differences`` is a set of dot-separated field paths to exclude:

    * ``"field"`` — skip ``field`` at the top level.
    * ``"parent.field"`` — skip ``field`` inside ``parent``.  If ``parent`` is a
      list of dicts, the exclusion applies to every element.  Callers must sort
      any list fields to the same order before calling if order should be ignored.

    Raises if any listed known difference is not actually different — unnecessary
    entries should be removed.

    ``unreliable`` is a set of dot-separated field paths that may or may not
    differ depending on test ordering (e.g. auto-incremented IDs from different
    tables).  These fields are silently skipped with no "must actually differ"
    check.  The field must still exist in both responses.

    Use sparingly — ``unreliable`` masks both real regressions and reliable
    consistency, so prefer ``known_differences`` when the field reliably differs.

    Examples::

        assert_serializer_parity(old=old, new=new)

        assert_serializer_parity(
            old=old,
            new=new,
            known_differences={"resolveThreshold", "triggers.resolveThreshold"},
        )

        assert_serializer_parity(
            old=old,
            new=new,
            unreliable={"activities.id"},
        )
    """
    known_diffs = frozenset(known_differences or ())
    unreliable_fields = frozenset(unreliable or ())
    checker = _ParityChecker()
    checker.compare(old, new, known_diffs, unreliable=unreliable_fields)

    assert not checker.mismatches, "Serializer differences:\n" + "\n".join(checker.mismatches)

    # known_diffs entries that were never confirmed as real differences are unnecessary.
    unnecessary = known_diffs - checker.confirmed
    assert not unnecessary, (
        "Unnecessary known_differences (no actual difference found):\n"
        + "\n".join(sorted(unnecessary))
    )


def _qualify(prefix: str, name: str) -> str:
    return f"{prefix}.{name}" if prefix else name


@dataclass
class _ParityChecker:
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
                                f"{item_path}: old={old_item!r}, new={new_item!r}"
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
                    self.mismatches.append(f"{full_path}: old={old_val!r}, new={new_val!r}")
            elif old_val != new_val:
                self.mismatches.append(f"{full_path}: old={old_val!r}, new={new_val!r}")
