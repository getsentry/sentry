from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


def assert_serializer_parity(
    *,
    old: Mapping[str, Any],
    new: Mapping[str, Any],
    known_differences: set[str] | None = None,
) -> None:
    """Assert that two serializer responses are equal, modulo known differences.

    ``known_differences`` is a set of dot-separated field paths to exclude:

    * ``"field"`` — skip ``field`` at the top level.
    * ``"parent.field"`` — skip ``field`` inside ``parent``.  If ``parent`` is a
      list of dicts, the exclusion applies to every element.  Callers must sort
      any list fields to the same order before calling if order should be ignored.

    Raises if any listed known difference is not actually different — unnecessary
    entries should be removed.

    Examples::

        assert_serializer_parity(old=old, new=new)

        assert_serializer_parity(
            old=old,
            new=new,
            known_differences={"resolveThreshold", "triggers.resolveThreshold"},
        )
    """
    known_diffs = frozenset(known_differences or ())
    checker = _ParityChecker()
    checker.compare(old, new, known_diffs)

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

    def _nested_diffs(self, known_diffs: frozenset[str], key: str) -> frozenset[str]:
        prefix = key + "."
        return frozenset(e[len(prefix) :] for e in known_diffs if e.startswith(prefix))

    def compare(
        self,
        old: Mapping[str, Any],
        new: Mapping[str, Any],
        known_diffs: frozenset[str],
        path: str = "",
        kd_path: str = "",
    ) -> None:
        for key in set(list(old.keys()) + list(new.keys())):
            if key in known_diffs:
                full_kd_key = _qualify(kd_path, key)
                if key not in new or key not in old or old[key] != new[key]:
                    self.confirmed.add(full_kd_key)
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
            nested = self._nested_diffs(known_diffs, key)

            if nested:
                child_kd_path = _qualify(kd_path, key)
                if isinstance(old_val, list) and isinstance(new_val, list):
                    if len(old_val) != len(new_val):
                        self.mismatches.append(
                            f"{full_path} count: old={len(old_val)}, new={len(new_val)}"
                        )
                    for i, (old_item, new_item) in enumerate(zip(old_val, new_val)):
                        item_path = f"{full_path}[{i}]"
                        if isinstance(old_item, Mapping) and isinstance(new_item, Mapping):
                            self.compare(old_item, new_item, nested, item_path, child_kd_path)
                        elif old_item != new_item:
                            self.mismatches.append(
                                f"{item_path}: old={old_item!r}, new={new_item!r}"
                            )
                elif isinstance(old_val, Mapping) and isinstance(new_val, Mapping):
                    self.compare(old_val, new_val, nested, full_path, child_kd_path)
                elif old_val != new_val:
                    self.mismatches.append(f"{full_path}: old={old_val!r}, new={new_val!r}")
            elif old_val != new_val:
                self.mismatches.append(f"{full_path}: old={old_val!r}, new={new_val!r}")
