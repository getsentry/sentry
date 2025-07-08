from sentry.dynamic_sampling.rules.biases.minimum_sample_rate_bias import MinimumSampleRateBias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, RuleType
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_generate_minimum_sample_rate_rule(default_project):
    base_sample_rate = 0.1
    rules = MinimumSampleRateBias().generate_rules(
        project=default_project, base_sample_rate=base_sample_rate
    )
    expected_rules = [
        {
            "samplingValue": {"type": "minimumSampleRate", "value": base_sample_rate},
            "type": "trace",
            "condition": {
                "inner": [],
                "op": "and",
            },
            "id": 1006,
        }
    ]
    assert rules == expected_rules


@django_db_all
def test_generate_rules_with_different_sample_rates(default_project):
    test_rates = [0.01, 0.05, 0.1, 0.5, 1.0]

    for base_sample_rate in test_rates:
        rules = MinimumSampleRateBias().generate_rules(
            project=default_project, base_sample_rate=base_sample_rate
        )

        expected_rules = [
            {
                "samplingValue": {"type": "minimumSampleRate", "value": base_sample_rate},
                "type": "trace",
                "condition": {
                    "inner": [],
                    "op": "and",
                },
                "id": RESERVED_IDS[RuleType.MINIMUM_SAMPLE_RATE_RULE],
            }
        ]

        assert rules == expected_rules
