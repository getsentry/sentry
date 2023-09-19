from datetime import timedelta
from unittest import mock

from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling.rules.biases.custom_rule_bias import CustomRuleBias
from sentry.models import CUSTOM_RULE_START, CustomDynamicSamplingRule, Project


@freeze_time("2023-09-19 10:00:00")
@mock.patch("sentry.models.CustomDynamicSamplingRule.get_project_rules")
def test_custom_rule_bias(custom_dynamic_sampling_rule_mock):
    """
    Test that the custom rule bias transforms the rules from the model into the expected format
    """
    p = Project(id=1)  # no need to save since I'm using as a mock parameter
    now = timezone.now()
    custom_dynamic_sampling_rule_mock.return_value = [
        CustomDynamicSamplingRule(
            start_date=now - timedelta(hours=1),
            end_date=now + timedelta(hours=1),
            rule_id=1,
            condition='{"op": "equals", "name": "environment", "value": "prod1"}',
            sample_rate=0.5,
            num_samples=100,
        ),
        CustomDynamicSamplingRule(
            start_date=now - timedelta(hours=1),
            end_date=now + timedelta(hours=1),
            rule_id=2,
            condition='{"op": "equals", "name": "environment", "value": "prod2"}',
            sample_rate=0.6,
            num_samples=101,
        ),
    ]

    bias = CustomRuleBias()

    rules = bias.generate_rules(p, 0.5)

    assert len(rules) == 2

    for rule in rules:
        assert rule["samplingValue"]["type"] == "sampleRate"
        assert rule["type"] == "transaction"
        assert rule["condition"]["op"] == "equals"
        assert rule["condition"]["name"] == "environment"
        assert rule["condition"]["value"] in ["prod1", "prod2"]
        assert rule["id"] in [CUSTOM_RULE_START + 1, CUSTOM_RULE_START + 2]
        assert rule["timeRange"]["start"] == "2023-09-19T09:00:00.000000Z"
        assert rule["timeRange"]["end"] == "2023-09-19T11:00:00.000000Z"
        assert rule["decayingFn"]["type"] == "reservoir"
        assert rule["decayingFn"]["limit"] in [100, 101]
