from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def assert_serializer_parity(
    old: Mapping[str, Any],
    new: Mapping[str, Any],
    known_differences: set[str] | None = None,
    *,
    label: str = "old vs new",
) -> None:
    """Assert that two serializer responses are equal, modulo known differences.

    ``known_differences`` is a set of dot-separated field paths to exclude:

    * ``"field"`` — skip ``field`` at the top level.
    * ``"parent.field"`` — skip ``field`` inside ``parent``.  If ``parent`` is a
      list of dicts, the exclusion applies to every element.  Callers must sort
      any list fields to the same order before calling.

    Raises if any listed known difference is not actually different — unnecessary
    entries should be removed.

    Examples::

        assert_serializer_parity(old, new, {"resolveThreshold"})

        assert_serializer_parity(
            old,
            new,
            {"resolveThreshold", "triggers.resolveThreshold"},
        )
    """
    known_diffs = known_differences or set()
    mismatches: list[str] = []
    fired: set[str] = set()
    unnecessary_candidates: set[str] = set()
    _collect_mismatches(old, new, known_diffs, mismatches, fired, unnecessary_candidates, "", "")
    unnecessary = (unnecessary_candidates - fired) | (known_diffs - fired - unnecessary_candidates)
    assert not mismatches, f"{label} serializer differences:\n" + "\n".join(mismatches)
    assert not unnecessary, (
        f"{label} unnecessary known_differences (no actual difference found):\n"
        + "\n".join(sorted(unnecessary))
    )


def _collect_mismatches(
    old: Mapping[str, Any],
    new: Mapping[str, Any],
    known_differences: set[str],
    mismatches: list[str],
    fired: set[str],
    unnecessary_candidates: set[str],
    path: str,
    kd_prefix: str,
) -> None:
    def _fp(field: str) -> str:
        return f"{path}.{field}" if path else field

    def _kd_key(field: str) -> str:
        return f"{kd_prefix}.{field}" if kd_prefix else field

    def _nested_diffs(field: str) -> set[str]:
        prefix = field + "."
        return {entry[len(prefix) :] for entry in known_differences if entry.startswith(prefix)}

    for field in set(list(old.keys()) + list(new.keys())):
        if field in known_differences:
            kd_key = _kd_key(field)
            if field not in new or field not in old or old[field] != new[field]:
                fired.add(kd_key)
            else:
                unnecessary_candidates.add(kd_key)
            continue

        fp = _fp(field)

        if field not in new:
            mismatches.append(f"Missing from new: {fp}")
            continue
        if field not in old:
            mismatches.append(f"Extra in new: {fp}")
            continue

        old_val = old[field]
        new_val = new[field]
        nested = _nested_diffs(field)

        if nested:
            new_kd_prefix = _kd_key(field)
            if isinstance(old_val, list) and isinstance(new_val, list):
                if len(old_val) != len(new_val):
                    mismatches.append(f"{fp} count: old={len(old_val)}, new={len(new_val)}")
                for i, (old_item, new_item) in enumerate(zip(old_val, new_val)):
                    item_path = f"{fp}[{i}]"
                    if isinstance(old_item, Mapping) and isinstance(new_item, Mapping):
                        _collect_mismatches(
                            old_item,
                            new_item,
                            nested,
                            mismatches,
                            fired,
                            unnecessary_candidates,
                            item_path,
                            new_kd_prefix,
                        )
                    elif old_item != new_item:
                        mismatches.append(f"{item_path}: old={old_item!r}, new={new_item!r}")
            elif isinstance(old_val, Mapping) and isinstance(new_val, Mapping):
                _collect_mismatches(
                    old_val,
                    new_val,
                    nested,
                    mismatches,
                    fired,
                    unnecessary_candidates,
                    fp,
                    new_kd_prefix,
                )
            elif old_val != new_val:
                mismatches.append(f"{fp}: old={old_val!r}, new={new_val!r}")
        elif old_val != new_val:
            mismatches.append(f"{fp}: old={old_val!r}, new={new_val!r}")
