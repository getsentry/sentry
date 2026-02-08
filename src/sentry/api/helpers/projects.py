from __future__ import annotations

from collections.abc import Iterable


def parse_id_or_slug_params(values: Iterable[str]) -> tuple[set[int], set[str]]:
    """
    Partition identifier strings into numeric IDs and slugs.

    All-digit values are treated as IDs, everything else as slugs.
    Uses ``.isdecimal()`` consistent with ``IdOrSlugLookup``.
    A single leading ``-`` is allowed to support the ``-1`` all-access sigil.
    """
    ids: set[int] = set()
    slugs: set[str] = set()
    for val in values:
        if not val:
            continue
        if val.isdecimal():
            ids.add(int(val))
        elif len(val) > 1 and val[0] == "-" and val[1:].isdecimal():
            ids.add(int(val))
        else:
            slugs.add(val)
    return ids, slugs
