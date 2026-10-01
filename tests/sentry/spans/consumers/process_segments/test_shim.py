from typing import cast

import pytest
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

    def test_defaults_platform_to_other(self) -> None:
        segment_span_empty_platform = build_segment_span(
            attributes={"sentry.platform": {"value": "", "type": "string"}}
        )
        segment_span_no_platform = build_segment_span()
        no_platform_attributes = segment_span_no_platform["attributes"]
        assert no_platform_attributes is not None
        del no_platform_attributes["sentry.platform"]

        event_empty_platform = build_shim_event_data(
            segment_span_empty_platform, [segment_span_empty_platform]
        )
        event_no_platform = build_shim_event_data(
            segment_span_no_platform, [segment_span_no_platform]
        )

        assert event_empty_platform["platform"] == "other"
        assert event_no_platform["platform"] == "other"

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
                # These end up in `event["user"]`
                "user.id": {"value": "1231908", "type": "string"},
                "user.geo.city": {"value": "Boston", "type": "string"},
                # These end up in `event["sdk"]`
                "sentry.sdk.name": {"value": "sentry.python", "type": "string"},
                "sentry.sdk.version": {"value": "4.15.13", "type": "string"},
                # These end up in `event["request"]`
                "url.query": {"value": "dogs=great", "type": "string"},
                "http.request.body.data": {
                    "value": '{"so": "much", "fur": "everywhere"}',
                    "type": "string",
                },
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

    def test_reconstructs_user(self) -> None:
        segment_span = build_segment_span(
            attributes={
                "user.id": {"value": "1231908", "type": "string"},
                "user.email": {"value": "maisey@dogpark.com", "type": "string"},
                "user.name": {"value": "maiseythedog", "type": "string"},
                "user.ip_address": {"value": "192.168.0.1", "type": "string"},
                "user.geo.country_code": {"value": "US", "type": "string"},
                "user.geo.region": {"value": "United States", "type": "string"},
                "user.geo.subdivision": {"value": "Massachusetts", "type": "string"},
                "user.geo.city": {"value": "Boston", "type": "string"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["user"] == {
            "id": "1231908",
            "email": "maisey@dogpark.com",
            "username": "maiseythedog",  # Not `user.name` - `event["user"]["username"]` is correct
            "ip_address": "192.168.0.1",
            "geo": {
                "country_code": "US",
                "region": "United States",
                "subdivision": "Massachusetts",
                "city": "Boston",
            },
        }

    def test_reconstructs_user_with_only_geo(self) -> None:
        # Relay derives `user.geo.*` from the client IP on both paths, but only ever gets identity
        # from the SDK, so geo-only is the normal shape for a segment from the span buffer.
        segment_span = build_segment_span(
            attributes={"user.geo.city": {"value": "Boston", "type": "string"}}
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["user"] == {"geo": {"city": "Boston"}}

    def test_reconstructs_sdk(self) -> None:
        segment_span = build_segment_span(
            attributes={
                "sentry.sdk.name": {"value": "sentry.python", "type": "string"},
                "sentry.sdk.version": {"value": "4.15.13", "type": "string"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["sdk"] == {"name": "sentry.python", "version": "4.15.13"}

    def test_reconstructs_request(self) -> None:
        segment_span = build_segment_span(
            attributes={
                "url.full": {"value": "https://dogs.are.great/dogpark", "type": "string"},
                "http.request.method": {"value": "GET", "type": "string"},
                "url.query": {"value": "sort=squirrels_caught&order=desc", "type": "string"},
                "http.request.body.data": {"value": '{"name": "Maisey"}', "type": "string"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["request"] == {
            "url": "https://dogs.are.great/dogpark",
            "method": "GET",
            "query_string": [("sort", "squirrels_caught"), ("order", "desc")],  # Params are parsed
            "data": {"name": "Maisey"},
        }

    @pytest.mark.parametrize(
        "url_attribute_names",
        (
            # Low -> high priority; we should use the highest priority one we have
            ("url.template", "http.route", "url.path", "url.full"),
            ("url.template", "http.route", "url.path"),
            ("url.template", "http.route"),
            ("url.template",),
        ),
        ids=repr,
    )
    def test_url_attribute_prioritization(self, url_attribute_names: tuple[str, ...]) -> None:
        # Which URL attribute we get is SDK-dependent, and the injection detectors match against
        # concrete URLs, so the most specific one present should win.
        segment_span = build_segment_span(
            attributes={
                attribute_name: {"value": f"{attribute_name}_value", "type": "string"}
                # Sort the names alphabetically so they're not added in priority order, thus proving
                # that it really is our prioritization that's controlling which one we use.
                for attribute_name in sorted(url_attribute_names)
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        # In each test case, the attribute names are ordered in increasing order of priority, so the
        # last one should always win
        assert event["request"]["url"] == f"{url_attribute_names[-1]}_value"

    def test_empty_attributes_do_not_displace_non_empty_ones(self) -> None:
        # Higher-priority attributes are listed last so that they overwrite lower-priority ones,
        # but that shouldn't mean that bad values can overwrite good ones.
        segment_span = build_segment_span(
            attributes={
                "url.path": {"value": "/dogpark", "type": "string"},  # lower priority, good value
                "url.full": {"value": "", "type": "string"},  # higher priority, but bad value
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["request"]["url"] == "/dogpark"

    @pytest.mark.parametrize(
        "body",
        (
            "dogs are great!",  # Not valid JSON
            '"dogs are great!"',  # Valid JSON because of the inner quotes, but not a dict
            '[{"dog": "Maisey"}]',  # Valid JSON but not a dict
            "90813",  # Valid JSON but not a dict
            "null",  # Valid JSON but not a dict
        ),
        ids=repr,
    )
    def test_drops_invalid_request_bodies(self, body: str) -> None:
        # Our detectors can only use dict-shaped request bodies, so if we have either invalid JSON
        # or valid JSON of the wrong shape, we can't use it. (Because such values aren't always
        # globally invalid (just useless to us), we don't error out, just skip them.)
        segment_span = build_segment_span(
            attributes={
                "url.path": {"value": "/dogpark", "type": "string"},
                "sentry.transaction.method": {"value": "GET", "type": "string"},
                "http.request.body.data": {"value": body, "type": "string"},
            }
        )

        event = build_shim_event_data(segment_span, [segment_span])

        # Invalid request body was dropped, but the rest of the request data made it through
        assert event["request"] == {"url": "/dogpark", "method": "GET"}

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
