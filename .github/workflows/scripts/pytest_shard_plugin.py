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
    if parts_file:
        with open(parts_file) as f:
            parts: dict[str, list[int]] = json.load(f)

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

    if os.environ.get("BACKEND_TEST_SERVICE_COLOR") == "general":
        # Catch transitive/inherited/autouse processing fixtures after collection.
        processing_fixtures = {
            "relay_server",
            "relay_server_setup",
            "relay_setup_fixtures",
            "_requires_symbolicator",
            "get_relay_store_url",
            "get_relay_security_url",
            "get_relay_minidump_url",
            "get_relay_unreal_url",
            "get_relay_attachments_url",
        }
        for item in items:
            required = processing_fixtures.intersection(getattr(item, "fixturenames", ()))
            if required:
                raise pytest.UsageError(
                    f"pytest_shard_plugin: {item.nodeid} needs processing fixtures "
                    f"{sorted(required)} on a general shard; add "
                    "'# backend-ci: processing' to that test file"
                )
