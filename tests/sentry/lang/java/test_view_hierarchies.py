from __future__ import annotations

from typing import Any
from unittest import mock

import orjson
import pytest

from sentry.attachments import CachedAttachment
from sentry.lang.java.view_hierarchies import ViewHierarchies, _serialize_view_hierarchy


def _deep_windows(depth: int) -> list[dict[str, Any]]:
    """Build a chain of nested windows `depth` levels deep."""
    windows: list[dict[str, Any]] = [{"type": f"class_{depth - 1}"}]
    for i in range(depth - 2, -1, -1):
        windows = [{"type": f"class_{i}", "children": windows}]
    return windows


def _walk_depth(windows: list[dict[str, Any]]) -> tuple[int, str]:
    depth = 0
    window = windows[0]
    while "children" in window:
        depth += 1
        window = window["children"][0]
    return depth, str(window.get("type", ""))


def test_serialize_view_hierarchy_falls_back_for_deep_nesting() -> None:
    hierarchy = {"windows": _deep_windows(300)}

    # Regression guard: this is the failure mode reported in gh-78685.
    with pytest.raises((orjson.JSONEncodeError, TypeError)):
        orjson.dumps(hierarchy)

    payload = _serialize_view_hierarchy(hierarchy)

    loaded = orjson.loads(payload)
    depth, last_type = _walk_depth(loaded["windows"])
    assert depth == 299
    assert last_type == "class_299"


def test_serialize_view_hierarchy_shallow_matches_orjson() -> None:
    hierarchy = {"windows": [{"type": "a", "children": [{"type": "b"}]}]}

    assert orjson.loads(_serialize_view_hierarchy(hierarchy)) == hierarchy


def test_deobfuscate_and_save_deeply_nested_hierarchy() -> None:
    depth = 300
    class_names = {f"class_{i}": f"mapped_{i}" for i in range(depth)}
    hierarchy = {"windows": _deep_windows(depth)}
    attachment = CachedAttachment(
        key="key:1",
        id=1,
        type="event.view_hierarchy",
        name="view_hierarchy.json",
        content_type="application/json",
        data=orjson.dumps(hierarchy),
    )

    get_attachments = mock.Mock(return_value=[attachment])
    store_attachments = mock.Mock()
    with (
        mock.patch(
            "sentry.lang.java.view_hierarchies.get_attachments_for_event",
            get_attachments,
        ),
        mock.patch(
            "sentry.lang.java.view_hierarchies.store_attachments_for_event",
            store_attachments,
        ),
    ):
        ViewHierarchies(project=mock.Mock(), data={}).deobfuscate_and_save(class_names)

    store_attachments.assert_called_once()
    stored = store_attachments.call_args.args[2]
    assert len(stored) == 1
    loaded = orjson.loads(stored[0].data)
    depth, last_type = _walk_depth(loaded["windows"])
    assert depth == 299
    assert last_type == "mapped_299"
