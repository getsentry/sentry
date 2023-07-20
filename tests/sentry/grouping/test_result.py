from __future__ import annotations

from typing import Any

from sentry.grouping.result import _write_tree_labels


def test_write_none_tree_label():
    event_data: dict[str, Any] = {}
    _write_tree_labels([None], event_data)
    assert event_data["hierarchical_tree_labels"] == [None]
