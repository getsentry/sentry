import json
from typing import Any

from sentry.lang.java.view_hierarchies import _serialize_view_hierarchy


def test_serialize_deep_view_hierarchy() -> None:
    window: dict[str, Any] = {"type": "com.example.View"}
    view_hierarchy = {"windows": [window]}

    for _ in range(300):
        child = {"type": "com.example.View"}
        window["children"] = [child]
        window = child

    assert json.loads(_serialize_view_hierarchy(view_hierarchy)) == view_hierarchy
