"""pytest plugin for one shard of a full run, loaded by pytest-selected.py.

The sentry plugin has already limited collection to this shard's files. This
keeps only this shard's part of each file that is split across shards, using
the same nodeid hash as the sentry plugin's per-test split. It only deselects,
so the remaining tests keep collection order.
"""

from __future__ import annotations

import json
import os
from hashlib import sha256
from pathlib import Path

import pytest


def item_part(nodeid: str, parts: int) -> int:
    return int(sha256(nodeid.encode()).hexdigest(), 16) % parts


def pytest_configure(config: pytest.Config) -> None:
    # pytest-selected.py writes paths relative to the working directory, and
    # the sentry plugin matches them relative to the rootdir.
    if os.environ.get("PYTEST_SHARD_PARTS") and config.rootpath != Path.cwd().resolve():
        raise pytest.UsageError(
            f"pytest_shard_plugin: rootdir {config.rootpath} is not the working "
            f"directory {Path.cwd()}; run pytest-selected.py from the rootdir"
        )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    parts_file = os.environ.get("PYTEST_SHARD_PARTS")
    if not parts_file:
        return
    with open(parts_file) as f:
        parts: dict[str, list[int]] = json.load(f)
    if not parts:
        return

    keep, discard = [], []
    for item in items:
        path = item.nodeid.split("::", 1)[0]
        if path in parts and item_part(item.nodeid, parts[path][1]) != parts[path][0]:
            discard.append(item)
        else:
            keep.append(item)
    items[:] = keep
    if discard:
        config.hook.pytest_deselected(items=discard)
