import pytest

from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_extraction_rules import MetricsExtractionRuleSerializer
from sentry.sentry_metrics.extraction_rules import MetricsExtractionRule, MetricsExtractionRuleState
from sentry.utils import json


def test_serialization():
    rules = [
        MetricsExtractionRule("count_clicks", "c", "none", {"tag_1", "tag_2"}, []),
        MetricsExtractionRule(
            "process_latency",
            "d",
            "none",
            {"tag_3"},
            ["first:value second:value", "foo:bar", "greetings:['hello', 'goodbye']"],
        ),
        MetricsExtractionRule("unique_ids", "s", "none", set(), ["foo:bar"]),
        MetricsExtractionRule("span.duration", "s", "millisecond", set(), ["foo:bar"]),
    ]

    rule_dict = {rule.generate_mri(): rule for rule in rules}

    state = MetricsExtractionRuleState(rule_dict)
    output_rules = state.get_rules()

    serialized = serialize(output_rules, serializer=MetricsExtractionRuleSerializer())

    assert len(serialized) == 4
    json_payload = json.dumps(serialized)

    serde_state = MetricsExtractionRuleState.from_json(json_payload)
    assert state == serde_state


def test_generate_mri():
    rule = MetricsExtractionRule("count_clicks", "c", "none", {"tag_1", "tag_2"}, [])
    mri = rule.generate_mri()
    assert mri == "c:custom/count_clicks@none"


def test_type_validation():
    rules = [
        MetricsExtractionRule("count_clicks", "c", "none", {"tag_1", "tag_2"}, []),
        MetricsExtractionRule(
            "process_latency",
            "d",
            "none",
            {"tag_3"},
            ["first:value second:value", "foo:bar", "greetings:['hello', 'goodbye']"],
        ),
        MetricsExtractionRule("unique_ids", "s", "none", set(), ["foo:bar"]),
    ]

    mris = [rule.generate_mri() for rule in rules]
    assert mris == [
        "c:custom/count_clicks@none",
        "d:custom/process_latency@none",
        "s:custom/unique_ids@none",
    ]

    with pytest.raises(ValueError):
        MetricsExtractionRule("count_clicks", "f", "none", {"tag_1", "tag_2"}, [])
    with pytest.raises(ValueError):
        MetricsExtractionRule("count_clicks", "distribution", "none", {"tag_1", "tag_2"}, [])


def test_hard_coded_units():
    rule = MetricsExtractionRule("span.duration", "c", "none", {"tag_1", "tag_2"}, [])
    mri = rule.generate_mri()
    assert mri == "c:custom/span.duration@none"

    rule = MetricsExtractionRule("span.duration", "d", "none", {"tag_1", "tag_2"}, [])
    mri = rule.generate_mri()
    assert mri == "d:custom/span.duration@millisecond"
