from __future__ import annotations

import orjson
import pytest

from sentry.attachments import CachedAttachment
from sentry.lang.java.view_hierarchies import ViewHierarchies, _serialize_view_hierarchy


def _deep_windows(depth: int) -> list[dict[str, object]]:
    """Build a chain of nested windows `depth` levels deep."""
    windows: list[dict[str, object]] = [{"type": f"class_{depth - 1}"}]
    for i in range(depth - 2, -1, -1):
        windows = [{"type": f"class_{i}", "children": windows}]
    return windows


def _walk_depth(windows: list[dict[str, object]]) -> tuple[int, str]:
    depth = 0
    window = windows[0]
    while "children" in window:
        depth += 1
        window = window["children"][0]
    return depth, window.get("type", "")


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


def test_deobfuscate_and_save_deeply_nested_hierarchy(monkeypatch) -> None:
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

    stored: list[CachedAttachment] = []

    def fake_get_attachments_for_event(event):
        return [attachment]

    def fake_store_attachments_for_event(project, event, attachments, timeout=None):
        stored.extend(attachments)

    monkeypatch.setattr(
        "sentry.lang.java.view_hierarchies.get_attachments_for_event",
        fake_get_attachments_for_event,
    )
    monkeypatch.setattr(
        "sentry.lang.java.view_hierarchies.store_attachments_for_event",
        fake_store_attachments_for_event,
    )

    ViewHierarchies(project=None, data={}).deobfuscate_and_save(class_names)

    assert len(stored) == 1
    loaded = orjson.loads(stored[0].data)
    depth, last_type = _walk_depth(loaded["windows"])
    assert depth == 299
    assert last_type == "mapped_299"
