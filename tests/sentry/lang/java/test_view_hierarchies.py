from typing import Any

import orjson
import pytest

from sentry.lang.java.view_hierarchies import _serialize_view_hierarchy
from sentry.utils import json


def test_serialize_deep_view_hierarchy() -> None:
    window: dict[str, Any] = {"type": "com.example.View"}
    view_hierarchy = {"windows": [window]}

    for _ in range(300):
        child = {"type": "com.example.View"}
        window["children"] = [child]
        window = child

    raw_attachment = json.dumps(view_hierarchy).encode()
    parsed_view_hierarchy = orjson.loads(raw_attachment)

    with pytest.raises(orjson.JSONEncodeError):
        orjson.dumps(parsed_view_hierarchy)

    assert json.loads(_serialize_view_hierarchy(parsed_view_hierarchy)) == view_hierarchy
