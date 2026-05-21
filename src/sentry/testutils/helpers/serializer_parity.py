from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.utils.payload_comparison import PayloadComparator


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
    checker = PayloadComparator(format_value=repr)
    checker.compare(old, new, known_diffs, unreliable=unreliable_fields)

    assert not checker.mismatches, "Serializer differences:\n" + "\n".join(checker.mismatches)

    # known_diffs entries that were never confirmed as real differences are unnecessary.
    unnecessary = known_diffs - checker.confirmed
    assert not unnecessary, (
        "Unnecessary known_differences (no actual difference found):\n"
        + "\n".join(sorted(unnecessary))
    )
