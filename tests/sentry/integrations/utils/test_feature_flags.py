from unittest.mock import MagicMock

from sentry.integrations.utils.feature_flags import EventFeatureFlag, get_event_feature_flags


def _make_event(data):
    event = MagicMock()
    event.data = data
    return event


def test_no_flags() -> None:
    assert get_event_feature_flags(_make_event({})) == []
    assert get_event_feature_flags(_make_event({"contexts": {"flags": {}}})) == []
    assert get_event_feature_flags(_make_event({"contexts": {"flags": {"values": "x"}}})) == []


def test_extracts_and_normalizes_flags() -> None:
    event = _make_event(
        {
            "contexts": {
                "flags": {
                    "values": [
                        {"flag": "a", "result": True},
                        {"flag": "b", "result": False},
                        {"result": True},
                        "not-a-dict",
                        {"flag": "c", "result": "variant-1"},
                    ]
                }
            }
        }
    )
    assert get_event_feature_flags(event) == [
        EventFeatureFlag(flag="a", result="true"),
        EventFeatureFlag(flag="b", result="false"),
        EventFeatureFlag(flag="c", result="variant-1"),
    ]
