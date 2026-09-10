from datetime import datetime, timezone
from typing import Any

import pytest

from sentry.api.serializers.rest_framework.base import (
    convert_dict_key_case,
    snake_to_camel_case,
)
from sentry.issues.formatting.adapter import event_response_to_model
from sentry.issues.formatting.sections import EVENT_SECTIONS_WITH_USER, format_issue


def _serialized_event() -> dict[str, Any]:
    return {
        "id": "abc123",
        "eventID": "abc123",
        "title": "ValueError: boom",
        "platform": "python",
        "dateCreated": "2024-01-01T00:00:00Z",
        "user": {"id": "1", "email": "user@example.com", "ipAddress": "1.2.3.4"},
        "contexts": {"browser": {"name": "Firefox"}},
        "tags": [
            {"key": "environment", "value": "prod"},
            {"key": "transaction", "value": "/checkout"},
        ],
        "entries": [
            {
                "type": "exception",
                "data": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "boom",
                            "mechanism": {"handled": False},
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "do_thing",
                                        "filename": "app.py",
                                        "absPath": "/srv/app.py",
                                        "lineNo": 42,
                                        "colNo": 5,
                                        "inApp": True,
                                        "context": [[42, "raise ValueError('boom')"]],
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            {
                "type": "breadcrumbs",
                "data": {"values": [{"type": "log", "category": "app", "message": "started"}]},
            },
            {
                "type": "request",
                "data": {"method": "GET", "url": "https://x.com", "data": {"q": 1}},
            },
            {"type": "message", "data": {"formatted": "boom happened"}},
            {
                "type": "spans",
                "data": [{"op": "db", "description": "SELECT 1", "exclusive_time": 12.5}],
            },
        ],
    }


def test_maps_event_level_fields() -> None:
    m = event_response_to_model(_serialized_event())
    assert m.event_id == "abc123"
    assert m.title == "ValueError: boom"
    assert m.platform == "python"
    assert m.message == "boom happened"
    assert m.transaction_name == "/checkout"
    assert m.contexts == {"browser": {"name": "Firefox"}}


def test_maps_top_level_culprit() -> None:
    data = _serialized_event() | {"culprit": "app.views.checkout"}
    assert event_response_to_model(data).culprit == "app.views.checkout"


def test_message_falls_back_to_entry_message_then_top_level() -> None:
    # message entry with `message` but no `formatted`
    entry_only = {"title": "t", "entries": [{"type": "message", "data": {"message": "raw msg"}}]}
    assert event_response_to_model(entry_only).message == "raw msg"
    # no message entry at all -> top-level message fallback
    top_level = {"title": "t", "message": "top msg"}
    assert event_response_to_model(top_level).message == "top msg"
    # formatted wins when present
    both = {
        "title": "t",
        "message": "top msg",
        "entries": [{"type": "message", "data": {"formatted": "fmt", "message": "raw"}}],
    }
    assert event_response_to_model(both).message == "fmt"


def test_maps_camelcase_frame_and_handled_flag() -> None:
    m = event_response_to_model(_serialized_event())
    exc = m.exceptions[0]
    assert exc.type == "ValueError"
    assert exc.is_handled is False  # from mechanism.handled
    assert exc.stacktrace is not None
    frame = exc.stacktrace.frames[0]
    assert frame.line_no == 42  # lineNo -> line_no
    assert frame.col_no == 5  # colNo -> col_no
    assert frame.abs_path == "/srv/app.py"  # absPath -> abs_path
    assert frame.in_app is True  # inApp -> in_app


def test_falls_back_to_raw_stacktrace() -> None:
    # processed stacktrace has no frames, but rawStacktrace does -> use raw
    data = {
        "title": "t",
        "entries": [
            {
                "type": "exception",
                "data": {
                    "values": [
                        {
                            "type": "E",
                            "stacktrace": {"frames": []},
                            "rawStacktrace": {"frames": [{"function": "raw_fn", "lineNo": 9}]},
                        }
                    ]
                },
            }
        ],
    }
    m = event_response_to_model(data)
    st = m.exceptions[0].stacktrace
    assert st is not None
    assert st.frames[0].function == "raw_fn"


def test_processed_stacktrace_preferred_over_raw() -> None:
    data = {
        "title": "t",
        "entries": [
            {
                "type": "exception",
                "data": {
                    "values": [
                        {
                            "type": "E",
                            "stacktrace": {"frames": [{"function": "processed_fn"}]},
                            "rawStacktrace": {"frames": [{"function": "raw_fn"}]},
                        }
                    ]
                },
            }
        ],
    }
    m = event_response_to_model(data)
    st = m.exceptions[0].stacktrace
    assert st is not None
    assert st.frames[0].function == "processed_fn"


def test_maps_breadcrumbs_request_spans_user_tags() -> None:
    m = event_response_to_model(_serialized_event())
    assert m.breadcrumbs[0].message == "started"
    # the spans entry keeps raw span keys, so exclusive_time needs no alias
    assert m.spans[0].exclusive_time == 12.5
    assert ("environment", "prod") in m.tags
    assert m.request is not None
    assert m.request.method == "GET"
    assert m.user is not None
    assert m.user.email == "user@example.com"
    assert m.user.ip_address == "1.2.3.4"  # ipAddress -> ip_address


def test_skips_tags_with_null_keys() -> None:
    # EventSerializer can emit {key: null, value: ...} for scrubbed/raw tag pairs.
    # null values are fine; null keys must not fail EventObject validation.
    data = _serialized_event()
    data["tags"] = [
        {"key": None, "value": "orphan"},
        {"key": "environment", "value": "prod"},
        {"key": None, "value": None},
        {"key": "level", "value": None},
    ]
    m = event_response_to_model(data)
    assert m.tags == [("environment", "prod"), ("level", None)]
    assert m.transaction_name is None


def test_no_truncation_in_adapter() -> None:
    # adapter is pure mapping: all breadcrumbs come through, capping is a render concern
    data = _serialized_event()
    data["entries"].append(
        {
            "type": "breadcrumbs",
            "data": {"values": [{"message": str(i)} for i in range(50)]},
        }
    )
    # note: later entry of same type wins, so this replaces the earlier breadcrumbs entry
    m = event_response_to_model(data)
    assert len(m.breadcrumbs) == 50


def test_breadcrumb_datetime_timestamp_does_not_crash() -> None:
    # the mixin passes the in-memory serialized event, where breadcrumb timestamps are
    # datetime objects (not yet JSON strings) -- parsing must not choke on them
    data = {
        "title": "t",
        "entries": [
            {
                "type": "breadcrumbs",
                "data": {
                    "values": [
                        {"message": "hi", "timestamp": datetime(2024, 1, 1, tzinfo=timezone.utc)}
                    ]
                },
            }
        ],
    }
    m = event_response_to_model(data)
    assert m.breadcrumbs[0].message == "hi"


def test_minimal_event() -> None:
    # a bare event (just a title) maps with everything else empty/absent
    m = event_response_to_model({"title": "t"})
    assert m.title == "t"
    assert m.exceptions == []
    assert m.breadcrumbs == []
    assert m.tags == []
    assert m.request is None
    assert m.user is None


def test_maps_csp_entry() -> None:
    data = {
        "title": "t",
        "entries": [
            {
                "type": "csp",
                "data": {
                    "effective_directive": "img-src",
                    "blocked_uri": "blob",
                    "document_uri": "https://x.com",
                    "original_policy": "default-src 'none'",  # dropped as noise
                },
            }
        ],
    }
    m = event_response_to_model(data)
    assert m.csp is not None
    assert m.csp.effective_directive == "img-src"
    assert m.csp.blocked_uri == "blob"
    assert m.csp.document_uri == "https://x.com"


def test_maps_occurrence_evidence() -> None:
    data = {
        "title": "t",
        "occurrence": {
            "evidenceDisplay": [
                {"name": "Regression", "value": "duration increased", "important": True},
                {"name": "Transaction", "value": "POST /oauth/token"},
                {"name": "", "value": "skip"},  # missing name/value pairs are skipped
            ]
        },
    }
    m = event_response_to_model(data)
    assert m.evidence == [
        ("Regression", "duration increased"),
        ("Transaction", "POST /oauth/token"),
    ]


def test_maps_detector_troubleshooting_context() -> None:
    # the Seer RPC adds these camelCase keys to the serialized event
    data = _serialized_event()
    data["detectionContext"] = "Opened by a Sentry detector."
    data["troubleshootingHint"] = "Filter the span before sending."
    m = event_response_to_model(data)
    assert m.detection_context == "Opened by a Sentry detector."
    assert m.troubleshooting_hint == "Filter the span before sending."


def test_detector_context_absent_by_default() -> None:
    m = event_response_to_model(_serialized_event())
    assert m.detection_context is None
    assert m.troubleshooting_hint is None


def test_maps_bare_stacktrace_entry() -> None:
    data = {
        "title": "t",
        "entries": [
            {"type": "stacktrace", "data": {"frames": [{"function": "f", "filename": "a.py"}]}}
        ],
    }
    m = event_response_to_model(data)
    assert m.stacktrace is not None
    assert [f.function for f in m.stacktrace.frames] == ["f"]


def test_bare_stacktrace_absent_by_default() -> None:
    assert event_response_to_model(_serialized_event()).stacktrace is None


def test_evidence_drops_reporter_identifiers() -> None:
    # feedback issues put contact_email/name in evidenceDisplay; those are user identifiers,
    # so they follow the same opt-in rule as user_section. The message is content, not an
    # identifier, so it survives.
    data = {
        "title": "t",
        "occurrence": {
            "evidenceDisplay": [
                {"name": "contact_email", "value": "someone@example.com", "important": False},
                {"name": "name", "value": "A Reporter", "important": False},
                {"name": "message", "value": "the button is broken", "important": True},
            ]
        },
    }
    m = event_response_to_model(data)
    assert m.evidence == [("message", "the button is broken")]


def test_feedback_context_drops_reporter_identifiers() -> None:
    # contexts.feedback carries the same contact details as evidenceDisplay, so it follows the
    # same rule -- but only there: `name` is real data on browser/os/runtime contexts
    data = {
        "title": "t",
        "contexts": {
            "feedback": {
                "name": "A Reporter",
                "contact_email": "someone@example.com",
                "message": "the button is broken",
                "associated_event_id": "abc123",
            },
            "browser": {"name": "Firefox", "version": "121.0"},
        },
    }
    m = event_response_to_model(data)
    assert m.contexts["feedback"] == {
        "message": "the button is broken",
        "associated_event_id": "abc123",
    }
    assert m.contexts["browser"] == {"name": "Firefox", "version": "121.0"}


@pytest.mark.parametrize("value", [None, "oops", 5, []])
def test_non_mapping_context_is_dropped_without_sinking_the_render(value: Any) -> None:
    # a context key holding anything but a mapping has nothing to render, and letting it reach
    # EventObject would fail dict[str, dict] validation inside the adapter -- which format_issue
    # absorbs by returning "", losing the whole event, not just this one context
    data = {
        "title": "t",
        "message": "boom",
        "contexts": {"feedback": value, "browser": {"name": "Firefox"}},
    }
    m = event_response_to_model(data)
    assert m.contexts == {"browser": {"name": "Firefox"}}
    assert "boom" in format_issue(data, sections=EVENT_SECTIONS_WITH_USER)


def _metric_issue(**evidence_overrides: Any) -> dict[str, Any]:
    evidence: dict[str, Any] = {
        "alertId": 77,
        "value": 812.4,
        "conditions": [{"type": "gt", "comparison": 500}],
        "dataSources": [
            {
                "queryObj": {
                    "snubaQuery": {
                        "dataset": "events_analytics_platform",
                        "aggregate": "p95(span.duration)",
                        "query": "transaction:/api/checkout",
                        "timeWindow": 3600,
                        "environment": "prod",
                    }
                }
            }
        ],
    }
    evidence.update(evidence_overrides)
    return {
        "title": "transaction.duration above 500",
        "occurrence": {"type": 8001, "evidenceData": evidence, "evidenceDisplay": []},
    }


def test_metric_alert_maps_the_whole_alert_definition() -> None:
    # evidenceDisplay only names the metric, so without evidenceData a metric issue renders
    # none of the query it fired on
    model = event_response_to_model(_metric_issue())
    assert model.metric_alert == [
        ("Dataset", "events_analytics_platform"),
        ("Aggregate", "p95(span.duration)"),
        ("Query", "transaction:/api/checkout"),
        ("Interval", "3600 second(s)"),
        ("Environment", "prod"),
        ("Evaluated Value", "812.4"),
        ("Threshold", "above 500"),
        ("Alert Rule ID", "77"),
    ]


def test_metric_alert_reads_the_keys_the_serializer_emits() -> None:
    # the detector stores evidence_data snake_cased, but EventSerializer camelCases the whole
    # occurrence recursively on the way out. Build the fixture through that same conversion so
    # the shape is the one the adapter really receives, not one written by hand.
    stored = {
        "type": 8001,
        "evidence_data": {
            "alert_id": 77,
            "value": 1.5,
            "conditions": [],
            "data_sources": [{"query_obj": {"snuba_query": {"dataset": "x", "time_window": 60}}}],
        },
    }
    model = event_response_to_model(
        {"title": "t", "occurrence": convert_dict_key_case(stored, snake_to_camel_case)}
    )
    assert ("Dataset", "x") in model.metric_alert
    assert ("Interval", "60 second(s)") in model.metric_alert
    assert ("Alert Rule ID", "77") in model.metric_alert

    # the snake_case shape the detector stores matches nothing by the time it reaches here
    assert event_response_to_model({"title": "t", "occurrence": stored}).metric_alert == []


@pytest.mark.parametrize(
    "condition,expected",
    [
        ({"type": "gt", "comparison": 500}, "above 500"),
        ({"type": "lt", "comparison": 2}, "below 2"),
        ({"type": "gte", "comparison": 10}, "at or above 10"),
        ({"type": "lte", "comparison": 10}, "at or below 10"),
        # DataConditionSnapshot types `type` as str, so a Condition value is what arrives;
        # anything else (including a legacy int) falls through to the bare comparison
        ({"comparison": 7}, "7"),
        ({"type": "eq", "comparison": 7}, "7"),
        ({"type": 0, "comparison": 7}, "7"),
    ],
)
def test_metric_alert_threshold_labels(condition: Any, expected: str) -> None:
    model = event_response_to_model(_metric_issue(conditions=[condition]))
    assert ("Threshold", expected) in model.metric_alert


def test_metric_alert_unwraps_anomaly_detection_value() -> None:
    # anomaly detection stores the evaluated value as {"value": ...}
    model = event_response_to_model(_metric_issue(value={"value": 9.5, "source_id": "s"}))
    assert ("Evaluated Value", "9.5") in model.metric_alert


def test_metric_alert_skips_missing_pieces() -> None:
    model = event_response_to_model(_metric_issue(dataSources=[], conditions=[]))
    assert model.metric_alert == [("Evaluated Value", "812.4"), ("Alert Rule ID", "77")]


def test_metric_alert_only_applies_to_metric_issues() -> None:
    event = _metric_issue()
    event["occurrence"]["type"] = 1001  # a perf issue
    assert event_response_to_model(event).metric_alert == []
    assert event_response_to_model({"title": "t"}).metric_alert == []


def test_metric_alert_renders_in_the_output() -> None:
    out = format_issue(_metric_issue(), sections=EVENT_SECTIONS_WITH_USER)
    assert "## Metric Alert Details" in out
    assert "**Aggregate:** p95(span.duration)" in out
    assert "**Threshold:** above 500" in out
