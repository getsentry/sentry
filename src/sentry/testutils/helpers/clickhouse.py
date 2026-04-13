"""
Helpers for forcing ClickHouse deduplication in tests via Snuba's test API.
"""

from __future__ import annotations

import requests
from django.conf import settings


def optimize_snuba_table(dataset: str) -> None:
    """Force ClickHouse to immediately deduplicate a ReplacingMergeTree dataset.

    Calls POST /tests/{dataset}/optimize on the local Snuba server, which runs
    ``OPTIMIZE TABLE … FINAL`` on every ClickHouse table in that dataset.

    This makes tombstoned rows from deletions, and replacement rows from
    merge/unmerge operations, take effect immediately without waiting for
    ClickHouse's background merge process.

    Args:
        dataset: Snuba dataset name, e.g. ``"events"``, ``"groupedmessage"``.

    Raises:
        RuntimeError: if the Snuba endpoint returns a non-200 response.
    """
    snuba_url = getattr(settings, "SENTRY_SNUBA", "http://127.0.0.1:1218")
    url = f"{snuba_url}/tests/{dataset}/optimize"
    resp = requests.post(url, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(
            f"Snuba /tests/{dataset}/optimize failed ({resp.status_code}): {resp.text}"
        )
