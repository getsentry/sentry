"""Guards against duplicate ``operation_id`` values across ``@extend_schema`` decorators.

Two operations sharing an ``operation_id`` produce an invalid OpenAPI document and
duplicate SDK function names. drf-spectacular's ``--fail-on-warn`` build only sees PUBLIC
operations, so it never catches a clash that involves a non-public method (e.g. a PUT/PATCH
pair on the same endpoint where only one is public). This test scans the source instead, so
it covers every ``@extend_schema`` regardless of publish status.

(Summary uniqueness — which guards against docs-URL collisions — is enforced separately in
``custom_postprocessing_hook``, where each operation's real summary is directly available.)
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

SENTRY_SRC = Path(__file__).resolve().parents[2] / "src" / "sentry"

# operation_id="..." appears only as an @extend_schema kwarg, so a literal scan is safe.
# Match either quote style so apostrophes inside double-quoted, sentence-style values
# (e.g. "List a Project's Tags") aren't truncated.
_OPERATION_ID = re.compile(r"""operation_id=(?:"([^"]*)"|'([^']*)')""")


def test_operation_ids_are_unique() -> None:
    locations: dict[str, list[str]] = defaultdict(list)
    for path in SENTRY_SRC.rglob("*.py"):
        with path.open(encoding="utf-8") as f:
            for lineno, line in enumerate(f, start=1):
                for double, single in _OPERATION_ID.findall(line):
                    value = double or single
                    rel = path.relative_to(SENTRY_SRC)
                    locations[value].append(f"src/sentry/{rel}:{lineno}")

    dups = {value: locs for value, locs in locations.items() if len(locs) > 1}
    assert not dups, "Duplicate @extend_schema operation_id values:\n" + "\n".join(
        f"  {value!r}: {', '.join(locs)}" for value, locs in sorted(dups.items())
    )
