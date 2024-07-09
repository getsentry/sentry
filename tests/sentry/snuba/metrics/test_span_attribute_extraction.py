from sentry.sentry_metrics.extraction_rules import MetricsExtractionRule
from sentry.snuba.metrics.span_attribute_extraction import (
    _SENTRY_TAGS,
    _TOP_LEVEL_SPAN_ATTRIBUTES,
    convert_to_metric_spec,
)


def test_convert_to_spec():
    rule = MetricsExtractionRule(
        span_attribute="span.duration",
        type="d",
        unit="millisecond",
        tags={"region", "http.status_code"},
        condition="region:[us, de] user_segment:vip",
        id=1,
    )
    metric_spec = convert_to_metric_spec(rule)

    expected_spec = {
        "category": "span",
        "mri": "d:custom/span_attribute_1@millisecond",
        "field": "span.duration",
        "tags": [
            {"key": "region", "field": "span.data.region"},
            {"key": "http.status_code", "field": "span.data.http\\.status_code"},
            {"key": "user_segment", "field": "span.data.user_segment"},
        ],
        "condition": {
            "op": "and",
            "inner": [
                {"op": "eq", "name": "span.data.region", "value": ["us", "de"]},
                {"op": "eq", "name": "span.data.user_segment", "value": "vip"},
            ],
        },
    }

    assert metric_spec["category"] == expected_spec["category"]
    assert metric_spec["mri"] == expected_spec["mri"]
    assert metric_spec["field"] == expected_spec["field"]
    assert len(metric_spec["tags"]) == len(expected_spec["tags"])
    assert metric_spec["condition"] == expected_spec["condition"]


def test_top_level_span_attribute():
    top_level_attributes = {
        "span.exclusive_time",
        "span.description",
        "span.op",
        "span.span_id",
        "span.parent_span_id",
        "span.trace_id",
        "span.status",
        "span.origin",
        "span.duration",
    }

    # Ensure that all top level attributes are covered
    assert top_level_attributes == _TOP_LEVEL_SPAN_ATTRIBUTES

    for attribute in top_level_attributes:
        rule = MetricsExtractionRule(
            span_attribute=attribute, type="d", unit="none", tags=set(), condition="", id=1
        )
        metric_spec = convert_to_metric_spec(rule)
        assert metric_spec["field"] == attribute


def test_sentry_tags():
    sentry_tags = {
        "release",
        "user",
        "user.id",
        "user.username",
        "user.email",
        "environment",
        "transaction",
        "transaction.method",
        "transaction.op",
        "mobile",
        "device.class",
        "browser.name",
        "sdk.name",
        "sdk.version",
        "platform",
        "action",
        "ai_pipeline_group",
        "category",
        "description",
        "domain",
        "raw_domain",
        "group",
        "http.decoded_response_content_length",
        "http.response_content_length",
        "http.response_transfer_size",
        "resource.render_blocking_status",
        "op",
        "status",
        "status_code",
        "system",
        "ttfd",
        "ttid",
        "file_extension",
        "main_thread",
        "cache.hit",
        "cache.key",
        "os.name",
        "app_start_type",
        "replay_id",
        "trace.status",
        "messaging.destination.name",
        "messaging.message.id",
    }

    # Ensure that all sentry tags are covered
    assert sentry_tags == _SENTRY_TAGS

    for tag in sentry_tags:
        rule = MetricsExtractionRule(
            span_attribute=tag, type="d", unit="none", tags=set(), condition="", id=1
        )
        metric_spec = convert_to_metric_spec(rule)
        assert metric_spec["field"] == f"span.sentry_tags.{tag}"
        assert metric_spec["mri"] == "d:custom/span_attribute_1@none"


def test_span_data_attribute_with_condition():
    rule = MetricsExtractionRule(
        span_attribute="foobar", type="d", unit="none", tags=set(), condition="foobar:baz", id=1
    )

    metric_spec = convert_to_metric_spec(rule)

    assert metric_spec["field"] == "span.data.foobar"
    assert metric_spec["mri"] == "d:custom/span_attribute_1@none"
    assert metric_spec["tags"] == [{"key": "foobar", "field": "span.data.foobar"}]
    assert metric_spec["condition"] == {"op": "eq", "name": "span.data.foobar", "value": "baz"}


def test_counter():
    rule = MetricsExtractionRule(
        span_attribute="foobar", type="c", unit="none", tags=set(), condition="", id=1
    )

    metric_spec = convert_to_metric_spec(rule)

    assert not metric_spec["field"]
    assert metric_spec["mri"] == "c:custom/span_attribute_1@none"
    assert metric_spec["condition"] == {
        "inner": {"name": "span.data.foobar", "op": "eq", "value": None},
        "op": "not",
    }


def test_counter_extends_conditions():
    rule = MetricsExtractionRule(
        span_attribute="foobar", type="c", unit="none", tags=set(), condition="abc:xyz", id=1
    )

    metric_spec = convert_to_metric_spec(rule)

    assert not metric_spec["field"]
    assert metric_spec["mri"] == "c:custom/span_attribute_1@none"
    assert metric_spec["condition"] == {
        "op": "and",
        "inner": [
            {"op": "eq", "name": "span.data.abc", "value": "xyz"},
            {"inner": {"name": "span.data.foobar", "op": "eq", "value": None}, "op": "not"},
        ],
    }


def test_span_duration_counter_not_extends_conditions():
    rule = MetricsExtractionRule(
        span_attribute="span.duration", type="c", unit="none", tags=set(), condition="abc:xyz", id=1
    )

    metric_spec = convert_to_metric_spec(rule)

    assert not metric_spec["field"]
    assert metric_spec["mri"] == "c:custom/span_attribute_1@none"
    assert metric_spec["condition"] == {
        "op": "eq",
        "name": "span.data.abc",
        "value": "xyz",
    }


def test_empty_conditions():
    rule = MetricsExtractionRule(
        span_attribute="foobar", type="d", unit="none", tags=set(), condition="", id=1
    )

    metric_spec = convert_to_metric_spec(rule)

    assert not metric_spec["condition"]
