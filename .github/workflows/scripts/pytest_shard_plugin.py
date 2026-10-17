"""pytest plugin for one shard of a full run, loaded by pytest-selected.py.

The sentry plugin has already limited collection to this shard's files. This
keeps only this shard's part of each file split across shards, and runs the
files slowest first so a slow file can't start last on an xdist worker.
"""

from __future__ import annotations

import json
import os
from hashlib import sha256

import pytest


def item_part(nodeid: str, parts: int) -> int:
    return int(sha256(nodeid.encode()).hexdigest(), 16) % parts


@pytest.hookimpl(trylast=True)
def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    plan_file = os.environ.get("PYTEST_SHARD_PLAN")
    if not plan_file:
        return
    with open(plan_file) as f:
        plan = json.load(f)
    parts: dict[str, list[int]] = plan["parts"]
    rank = {path: i for i, path in enumerate(plan["order"])}

    keep, discard = [], []
    for item in items:
        path = item.nodeid.split("::", 1)[0]
        if path in parts and item_part(item.nodeid, parts[path][1]) != parts[path][0]:
            discard.append(item)
        else:
            keep.append(item)
    # Stable, so tests within a file keep their order.
    keep.sort(key=lambda item: rank.get(item.nodeid.split("::", 1)[0], len(rank)))
    items[:] = keep
    if discard:
        config.hook.pytest_deselected(items=discard)
