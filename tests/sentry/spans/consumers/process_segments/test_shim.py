from typing import cast

from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry.spans.consumers.process_segments.shim import (
    build_shim_event_data,
    make_compatible,
)
from sentry.spans.consumers.process_segments.types import (
    Attributes,
    CompatibleSpan,
    attribute_value,
)
from tests.sentry.spans.consumers.process import build_mock_span
from tests.sentry.spans.consumers.process_segments.test_convert import SPAN_KAFKA_MESSAGE


def build_segment_span(**kwargs) -> CompatibleSpan:
    segment_span = build_mock_span(project_id=415, is_segment=True, hash="dogs_are_great", **kwargs)
    return make_compatible(segment_span)


def test_make_compatible() -> None:
    message = {**SPAN_KAFKA_MESSAGE}
    attributes: Attributes = {
        "sentry.exclusive_time_ms": {"type": "double", "value": 100.0},
        **message["attributes"],  # type:ignore[dict-item]
    }
    message["attributes"] = attributes
    compatible = make_compatible(cast(SpanEvent, message))
    assert compatible["exclusive_time"] == 100.0
    assert compatible["op"] == message["attributes"]["sentry.op"]["value"]  # type: ignore[index]

    # Pre-existing tags got overwritten:
    assert compatible["sentry_tags"] == {
        "description": "normalized_description",
        "environment": "development",
        "platform": "python",
        "release": "backend@24.7.0.dev0+c45b49caed1e5fcbf70097ab3f434b487c359b6b",
        "sdk.name": "sentry.python.django",
    }


class TestBuildShimEventData:
    def test_sets_top_level_event_fields(self) -> None:
        segment_span = build_segment_span(
            attributes={
                "sentry.segment.name": {"value": "/dogpark", "type": "string"},
                "sentry.dist": {"value": "1.0", "type": "string"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["type"] == "transaction"
        assert event["level"] == "info"
        assert event["dist"] == attribute_value(segment_span, "sentry.dist")
        assert event["environment"] == attribute_value(segment_span, "sentry.environment")
        assert event["platform"] == attribute_value(segment_span, "sentry.platform")
        assert event["project_id"] == segment_span["project_id"]
        assert event["received"] == segment_span["received"]
        assert event["release"] == attribute_value(segment_span, "sentry.release")
        assert event["start_timestamp"] == segment_span["start_timestamp"]
        assert event["timestamp"] == segment_span["end_timestamp"]
        assert event["transaction"] == attribute_value(segment_span, "sentry.segment.name")

    def test_reconstructs_contexts(self) -> None:
        segment_span = build_segment_span(
            attributes={
                "browser.name": {"value": "Chrome", "type": "string"},
                "browser.version": {"value": "120", "type": "string"},
                "device.family": {"value": "Mac", "type": "string"},
                "os.name": {"value": "Mac OS X", "type": "string"},
                "os.version": {"value": "14.5", "type": "string"},
                "process.runtime.name": {"value": "CPython", "type": "string"},
                "process.runtime.version": {"value": "3.13.1", "type": "string"},
                "sentry.profile_id": {"value": "11211231415908", "type": "string"},
                "sentry.transaction.op": {"value": "fetch", "type": "string"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])
        contexts = event["contexts"]

        assert contexts["browser"] == {
            "name": "Chrome",
            "version": "120",
            "type": "browser",
        }
        assert contexts["device"] == {
            "family": "Mac",
            "type": "device",
        }
        assert contexts["os"] == {
            "name": "Mac OS X",
            "version": "14.5",
            "type": "os",
        }
        assert contexts["profile"] == {
            "profile_id": "11211231415908",
            "type": "profile",
        }
        assert contexts["runtime"] == {
            "name": "CPython",
            "version": "3.13.1",
            "type": "runtime",
        }
        assert contexts["trace"] == {
            "trace_id": segment_span["trace_id"],
            "span_id": segment_span["span_id"],
            "op": "fetch",
            "hash": "dogs_are_great",
            "type": "trace",
        }

    def test_reconstructs_tags(self) -> None:
        segment_span = build_segment_span(
            attributes={
                "dog.name": {"value": "charlie", "type": "string"},
                "dog.type": {"value": "goofy", "type": "string"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert sorted(event["tags"]) == [["dog.name", "charlie"], ["dog.type", "goofy"]]

    def test_excludes_attributes_used_elsewhere_in_the_event_from_tags(self) -> None:
        segment_span = build_segment_span(
            attributes={
                "dog.name": {"value": "maisey", "type": "string"},
                # These end up at the top level of the event
                "sentry.segment.name": {"value": "/dogpark", "type": "string"},
                "sentry.platform": {"value": "python", "type": "string"},
                # These end up in `event["contexts"]`
                "sentry.profile_id": {"value": "11211231415908", "type": "string"},
                "browser.name": {"value": "chrome", "type": "string"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["tags"] == [["dog.name", "maisey"]]

    def test_excludes_non_string_attributes_from_tags(self) -> None:
        segment_span = build_segment_span(
            attributes={
                "dog.name": {"value": "charlie", "type": "string"},
                "dog.weight": {"value": 58.4, "type": "double"},
                "dogs.age": {"value": 13, "type": "integer"},
                "is_good": {"value": True, "type": "boolean"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["tags"] == [["dog.name", "charlie"]]

    def test_lifts_span_description_to_the_top_level(self) -> None:
        segment_span = build_segment_span(description="SELECT * FROM dogs")

        event = build_shim_event_data(segment_span, [segment_span])
        [event_span] = event["spans"]

        assert event_span["description"] == attribute_value(segment_span, "sentry.description")

    def test_copies_attributes_into_span_data(self) -> None:
        segment_span = build_segment_span()
        assert segment_span["attributes"]  # mypy appeasement

        event = build_shim_event_data(segment_span, [segment_span])
        [event_span] = event["spans"]

        for key in segment_span["attributes"]:
            assert event_span["data"][key] == attribute_value(segment_span, key)

    def test_does_not_modify_the_spans_it_is_given(self) -> None:
        segment_span = build_segment_span(description="SELECT * FROM dogs")

        event = build_shim_event_data(segment_span, [segment_span])
        [event_span] = event["spans"]

        assert event_span is not segment_span
        for legacy_field in ("description", "timestamp", "data"):
            assert legacy_field in event_span
            assert legacy_field not in segment_span
