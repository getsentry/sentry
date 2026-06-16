"""Guards against duplicate ``operation_id`` / ``summary`` values in
``@extend_schema`` decorators.

Two operations sharing an ``operation_id`` produce an invalid OpenAPI document and
duplicate SDK function names; two sharing a ``summary`` collide on the same docs URL
(the API reference derives the page slug from ``summary``). Both are easy to introduce
by accident — especially PUT/PATCH pairs on the same endpoint — and the drf-spectacular
``--fail-on-warn`` build only sees PUBLIC operations, so it never catches a clash that
involves a non-public method. This test scans the source instead, so it covers every
``@extend_schema`` regardless of publish status.
"""

from __future__ import annotations

import ast
import os
from collections import defaultdict

SENTRY_SRC = os.path.join(os.path.dirname(__file__), "..", "..", "src", "sentry")


def _iter_extend_schema_kwargs() -> list[tuple[str, str, str]]:
    """Yield (kwarg_name, value, "path:line") for every string-literal ``operation_id``
    and ``summary`` kwarg passed to an ``extend_schema(...)`` call under src/sentry."""
    found: list[tuple[str, str, str]] = []
    for root, _dirs, files in os.walk(SENTRY_SRC):
        for name in files:
            if not name.endswith(".py"):
                continue
            path = os.path.join(root, name)
            try:
                with open(path, encoding="utf-8") as f:
                    tree = ast.parse(f.read(), filename=path)
            except (SyntaxError, UnicodeDecodeError):
                continue
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                func = node.func
                fname = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
                if fname != "extend_schema":
                    continue
                for kw in node.keywords:
                    if (
                        kw.arg in ("operation_id", "summary")
                        and isinstance(kw.value, ast.Constant)
                        and isinstance(kw.value.value, str)
                    ):
                        rel = os.path.relpath(path, SENTRY_SRC)
                        found.append((kw.arg, kw.value.value, f"src/sentry/{rel}:{kw.lineno}"))
    return found


def _duplicates(kwarg: str) -> dict[str, list[str]]:
    locations: dict[str, list[str]] = defaultdict(list)
    for name, value, loc in _iter_extend_schema_kwargs():
        if name == kwarg:
            locations[value].append(loc)
    return {value: locs for value, locs in locations.items() if len(locs) > 1}


def test_operation_ids_are_unique() -> None:
    dups = _duplicates("operation_id")
    assert not dups, "Duplicate @extend_schema operation_id values:\n" + "\n".join(
        f"  {value!r}: {', '.join(locs)}" for value, locs in sorted(dups.items())
    )


def test_summaries_are_unique() -> None:
    # The docs page slug is slugify(summary); duplicates collide on the same URL.
    dups = _duplicates("summary")
    assert not dups, "Duplicate @extend_schema summary values (docs URL collision):\n" + "\n".join(
        f"  {value!r}: {', '.join(locs)}" for value, locs in sorted(dups.items())
    )
