from sentry.sentry_metrics.extraction_rules import MetricsExtractionRule
from sentry.snuba.metrics.span_attribute_extraction import convert_to_spec

expected_spec = {
    "category": "span",
    "mri": "d:custom/span.duration@millisecond",
    "field": "span.duration",
    "tags": [
        {"key": "region", "field": "span.data.region"},
        {"key": "http.status_code", "field": "span.data.http\\.status_code"},
        {"key": "foo", "field": "span.data.foo"},
        {"key": "user_segment", "field": "span.data.user_segment"},
    ],
    "condition": {
        "op": "or",
        "inner": [
            {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "span.data.region", "value": ["us", "de"]},
                    {"op": "eq", "name": "span.data.user_segment", "value": "vip"},
                ],
            },
            {"op": "eq", "name": "span.data.foo", "value": "bar"},
        ],
    },
}

_input = MetricsExtractionRule(
    span_attribute="span.duration",
    type="d",
    unit="millisecond",
    tags={"region", "http.status_code"},
    conditions=["region:[us, de] user_segment:vip", "foo:bar"],
)


def test_convert_to_spec():
    converted = convert_to_spec(_input)

    assert converted["category"] == expected_spec["category"]
    assert converted["mri"] == expected_spec["mri"]
    assert converted["field"] == expected_spec["field"]
    assert len(converted["tags"]) == len(expected_spec["tags"])
    assert converted["condition"] == expected_spec["condition"]


def test_span_data_attribute():
    rule = MetricsExtractionRule(
        span_attribute="foobar", type="d", unit="none", tags=set(), conditions=[]
    )

    converted = convert_to_spec(rule)

    assert converted["field"] == "span.data.foobar"
    assert converted["mri"] == "d:custom/foobar@none"
    assert converted["tags"] == []


def test_span_data_attribute_with_condition():
    rule = MetricsExtractionRule(
        span_attribute="foobar", type="d", unit="none", tags=set(), conditions=["foobar:baz"]
    )

    converted = convert_to_spec(rule)

    assert converted["field"] == "span.data.foobar"
    assert converted["mri"] == "d:custom/foobar@none"
    assert converted["tags"] == [{"key": "foobar", "field": "span.data.foobar"}]
    assert converted["condition"] == {"op": "eq", "name": "span.data.foobar", "value": "baz"}


def test_counter():
    rule = MetricsExtractionRule(
        span_attribute="foobar", type="c", unit="none", tags=set(), conditions=[]
    )

    converted = convert_to_spec(rule)

    assert converted["field"] == "span.data.foobar"
    assert converted["mri"] == "c:custom/foobar@none"
    assert converted["tags"] == []
