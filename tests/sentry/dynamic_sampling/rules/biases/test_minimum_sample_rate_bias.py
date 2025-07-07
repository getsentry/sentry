from sentry.dynamic_sampling.rules.base import generate_rules
from sentry.dynamic_sampling.rules.biases.minimum_sample_rate_bias import MinimumSampleRateBias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, RuleType
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_generate_rules_with_minimum_sample_rate_enabled(default_project):
    """
    Test that MinimumSampleRateBias generates rules when the project option is enabled.
    """
    # Enable the minimum sample rate option
    default_project.update_option("sentry:dynamic_sampling_minimum_sample_rate", True)

    base_sample_rate = 0.1
    rules = MinimumSampleRateBias().generate_rules(
        project=default_project, base_sample_rate=base_sample_rate
    )

    expected_rules = [
        {
            "samplingValue": {"type": "minimumSampleRate", "value": base_sample_rate},
            "type": "trace",
            "condition": {},
            "id": RESERVED_IDS[RuleType.MINIMUM_SAMPLE_RATE_RULE],
        }
    ]

    assert rules == expected_rules


@django_db_all
def test_generate_rules_with_minimum_sample_rate_disabled(default_project):
    """
    Test that MinimumSampleRateBias does not generate rules when the project option is disabled.
    """
    # Disable the minimum sample rate option (default is False)
    default_project.update_option("sentry:dynamic_sampling_minimum_sample_rate", False)

    base_sample_rate = 0.1
    rules = MinimumSampleRateBias().generate_rules(
        project=default_project, base_sample_rate=base_sample_rate
    )

    assert rules == []


@django_db_all
def test_generate_rules_with_minimum_sample_rate_not_set(default_project):
    """
    Test that MinimumSampleRateBias does not generate rules when the project option is not set (default).
    """
    # Don't set the option (default is False)
    base_sample_rate = 0.1
    rules = MinimumSampleRateBias().generate_rules(
        project=default_project, base_sample_rate=base_sample_rate
    )

    assert rules == []


@django_db_all
def test_generate_rules_with_different_sample_rates(default_project):
    """
    Test that MinimumSampleRateBias generates rules with different sample rates when enabled.
    """
    # Enable the minimum sample rate option
    default_project.update_option("sentry:dynamic_sampling_minimum_sample_rate", True)

    test_rates = [0.01, 0.05, 0.1, 0.5, 1.0]

    for base_sample_rate in test_rates:
        rules = MinimumSampleRateBias().generate_rules(
            project=default_project, base_sample_rate=base_sample_rate
        )

        expected_rules = [
            {
                "samplingValue": {"type": "minimumSampleRate", "value": base_sample_rate},
                "type": "trace",
                "condition": {},
                "id": RESERVED_IDS[RuleType.MINIMUM_SAMPLE_RATE_RULE],
            }
        ]

        assert rules == expected_rules


@django_db_all
def test_generate_rules_with_truthy_values(default_project):
    """
    Test that MinimumSampleRateBias generates rules when the project option is set to truthy values.
    """
    # Test various truthy values
    truthy_values = [True, 1, "true", "1"]

    for value in truthy_values:
        default_project.update_option("sentry:dynamic_sampling_minimum_sample_rate", value)

        base_sample_rate = 0.1
        rules = MinimumSampleRateBias().generate_rules(
            project=default_project, base_sample_rate=base_sample_rate
        )

        expected_rules = [
            {
                "samplingValue": {"type": "minimumSampleRate", "value": base_sample_rate},
                "type": "trace",
                "condition": {},
                "id": RESERVED_IDS[RuleType.MINIMUM_SAMPLE_RATE_RULE],
            }
        ]

        assert rules == expected_rules, f"Failed for value: {value}"


@django_db_all
def test_generate_rules_with_falsy_values(default_project):
    """
    Test that MinimumSampleRateBias does not generate rules when the project option is set to falsy values.
    """
    # Test various falsy values
    falsy_values = [False, 0, "", None]

    for value in falsy_values:
        default_project.update_option("sentry:dynamic_sampling_minimum_sample_rate", value)

        base_sample_rate = 0.1
        rules = MinimumSampleRateBias().generate_rules(
            project=default_project, base_sample_rate=base_sample_rate
        )

        assert rules == [], f"Failed for value: {value}"


@django_db_all
def test_minimum_sample_rate_bias_order_in_project_config(default_project):
    """
    Test that the minimum sample rate bias appears in the correct order when integrated
    with other biases in the project configuration.
    """
    # Enable minimum sample rate and other biases
    default_project.update_option("sentry:dynamic_sampling_minimum_sample_rate", True)
    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": "boostReplayId", "active": True},
            {"id": "ignoreHealthChecks", "active": True},
        ],
    )

    # Generate all rules for the project
    rules = generate_rules(default_project)

    # Extract rule IDs to verify order
    rule_ids = [rule["id"] for rule in rules]

    # Expected rule IDs in order based on the combinator in combine.py:
    # 1. ignoreHealthChecks (1002) - appears first due to combinator order
    # 2. boostReplayId (1005)
    # 3. minimumSampleRate (1600) - should appear near the end
    # 4. uniformRule (1000) - boost low volume projects, always last

    expected_rule_ids = [
        RESERVED_IDS[RuleType.IGNORE_HEALTH_CHECKS_RULE],  # 1002
        RESERVED_IDS[RuleType.BOOST_REPLAY_ID_RULE],  # 1005
        RESERVED_IDS[RuleType.MINIMUM_SAMPLE_RATE_RULE],  # 1600
        RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE],  # 1000 (uniformRule)
    ]

    assert rule_ids == expected_rule_ids

    # Also verify that minimum sample rate rule has the correct structure
    minimum_sample_rate_rule = next(
        rule for rule in rules if rule["id"] == RESERVED_IDS[RuleType.MINIMUM_SAMPLE_RATE_RULE]
    )

    assert minimum_sample_rate_rule["samplingValue"]["type"] == "minimumSampleRate"
    assert minimum_sample_rate_rule["type"] == "trace"
    assert minimum_sample_rate_rule["condition"] == {}


@django_db_all
def test_minimum_sample_rate_bias_not_included_when_disabled(default_project):
    """
    Test that the minimum sample rate bias is not included in project config when disabled.
    """
    # Disable minimum sample rate but enable other biases
    default_project.update_option("sentry:dynamic_sampling_minimum_sample_rate", False)
    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": "boostReplayId", "active": True},
            {"id": "ignoreHealthChecks", "active": True},
        ],
    )

    # Generate all rules for the project
    rules = generate_rules(default_project)

    # Extract rule IDs
    rule_ids = [rule["id"] for rule in rules]

    # Minimum sample rate rule should not be present
    assert RESERVED_IDS[RuleType.MINIMUM_SAMPLE_RATE_RULE] not in rule_ids

    # But other rules should still be present
    expected_rule_ids = [
        RESERVED_IDS[RuleType.IGNORE_HEALTH_CHECKS_RULE],
        RESERVED_IDS[RuleType.BOOST_REPLAY_ID_RULE],
        RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE],  # Always included
    ]

    assert rule_ids == expected_rule_ids
