from typing import int
from sentry.workflow_engine.utils import dictpath


def test_basic() -> None:
    data = {
        "a": {
            "b": {
                "c": 1,
            },
        },
    }
    assert dictpath.walk(5).get() == 5
    assert dictpath.walk({}, "no", "nope").get("") == ""
    assert dictpath.walk(data, "a", "b", "c").get() == 1
    assert dictpath.walk(data, "a", "b", "c").is_type(int).get() == 1
    assert dictpath.walk(data, "a", "b", "c").is_type(str).failed()
    assert dictpath.walk(data, "nope", "b", "c").get(1) == 1
