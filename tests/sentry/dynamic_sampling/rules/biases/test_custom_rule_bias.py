from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.dynamic_sampling.rules.biases.custom_rule_bias import CustomRuleBias
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.models.project import Project
from sentry.testutils.helpers.datetime import freeze_time


@freeze_time("2023-09-19 10:00:00")
@mock.patch("sentry.models.CustomDynamicSamplingRule.get_project_rules")
def test_custom_rule_bias(custom_dynamic_sampling_rule_mock, insta_snapshot):
    """
    Test that the custom rule bias transforms the rules from the model into the expected format.
    """
    p = Project(id=1)  # no need to save since I'm using as a mock parameter
    now = timezone.now()
    custom_dynamic_sampling_rule_mock.return_value = [
        CustomDynamicSamplingRule(
            start_date=now - timedelta(hours=1),
            end_date=now + timedelta(hours=1),
            rule_id=1,
            condition='{"op": "eq", "name": "event.transaction", "value": "/hello"}',
            sample_rate=0.5,
            num_samples=100,
        ),
        CustomDynamicSamplingRule(
            start_date=now - timedelta(hours=1),
            end_date=now + timedelta(hours=1),
            rule_id=2,
            condition='{"op": "and", "inner": []}',
            sample_rate=0.6,
            num_samples=101,
        ),
    ]

    bias = CustomRuleBias()
    rules = bias.generate_rules(p, 0.5)

    assert len(rules) == 2
    insta_snapshot(rules)


@freeze_time("2023-09-19 10:00:00")
@mock.patch("sentry.models.CustomDynamicSamplingRule.get_project_rules")
def test_custom_rule_bias_with_invalid_condition(custom_dynamic_sampling_rule_mock, insta_snapshot):
    """
    Test that the custom rule bias throws an error if the condition is invalid.
    """
    p = Project(id=1)  # no need to save since I'm using as a mock parameter
    now = timezone.now()

    invalid_rules = []
    for invalid_condition in ("", "{}", '{"op": "and"}'):
        invalid_rules.append(
            CustomDynamicSamplingRule(
                start_date=now - timedelta(hours=1),
                end_date=now + timedelta(hours=1),
                rule_id=2,
                condition=invalid_condition,
                sample_rate=0.6,
                num_samples=101,
            ),
        )

    custom_dynamic_sampling_rule_mock.return_value = invalid_rules

    bias = CustomRuleBias()
    rules = bias.generate_rules(p, 0.5)

    # We expect no rules to be generated.
    assert len(rules) == 0
    insta_snapshot(rules)
