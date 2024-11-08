import uuid

import pytest

from sentry.sentry_metrics.extraction_rules import MetricsExtractionRule


def _new_id():
    return str(uuid.uuid4())


def test_generate_mri():
    rule = MetricsExtractionRule("count_clicks", "c", "none", {"tag_1", "tag_2"}, "", 12378)
    mri = rule.generate_mri()
    assert mri == "c:custom/span_attribute_12378@none"


def test_type_validation():
    rules = [
        MetricsExtractionRule("count_clicks", "c", "none", {"tag_1", "tag_2"}, "", 7423),
        MetricsExtractionRule(
            "process_latency", "d", "none", {"tag_3"}, "first:value second:value", 239478
        ),
        MetricsExtractionRule("unique_ids", "s", "none", set(), "foo:bar", 278934),
    ]

    mris = [rule.generate_mri() for rule in rules]
    assert mris == [
        "c:custom/span_attribute_7423@none",
        "d:custom/span_attribute_239478@none",
        "s:custom/span_attribute_278934@none",
    ]

    with pytest.raises(ValueError):
        MetricsExtractionRule("count_clicks", "f", "none", {"tag_1", "tag_2"}, "", 128903)
    with pytest.raises(ValueError):
        MetricsExtractionRule(
            "count_clicks", "distribution", "none", {"tag_1", "tag_2"}, "", 123678
        )
