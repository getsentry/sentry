from unittest.mock import MagicMock, patch

from sentry.dynamic_sampling import generate_rules


@patch("sentry.dynamic_sampling.sentry_sdk")
@patch("sentry.dynamic_sampling.quotas.get_blended_sample_rate")
def test_generate_rules_capture_exception(get_blended_sample_rate, sentry_sdk):
    get_blended_sample_rate.return_value = None
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    # if blended rate is None that means no dynamic sampling behavior should happen.
    # Therefore no rules should be set.
    assert generate_rules(fake_project) == []
    get_blended_sample_rate.assert_called_with(fake_project)
    sentry_sdk.capture_exception.assert_called_with()


@patch(
    "sentry.dynamic_sampling.feature_multiplexer.DynamicSamplingFeatureMultiplexer.get_user_bias_by_id"
)
@patch("sentry.dynamic_sampling.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_with_rate(get_blended_sample_rate, get_user_bias):
    get_user_bias.return_value = {"id": "boostEnvironments", "active": False}
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    assert generate_rules(fake_project) == [
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 0,
            "sampleRate": 0.1,
            "type": "trace",
        }
    ]
    get_blended_sample_rate.assert_called_with(fake_project)
    get_user_bias.assert_called_with(
        "boostEnvironments", fake_project.get_option("sentry:dynamic_sampling_biases", None)
    )


@patch("sentry.dynamic_sampling.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_env_rule(get_blended_sample_rate):
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    assert generate_rules(fake_project) == [
        {
            "sampleRate": 1,
            "type": "trace",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "glob",
                        "name": "trace.environment",
                        "value": ["*dev*", "*test*"],
                        "options": {"ignoreCase": True},
                    }
                ],
            },
            "active": True,
            "id": 1,
        },
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 0,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(fake_project)


@patch("sentry.dynamic_sampling.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_100_rate_and_without_env_rule(
    get_blended_sample_rate,
):
    get_blended_sample_rate.return_value = 1.0
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    assert generate_rules(fake_project) == [
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 0,
            "sampleRate": 1.0,
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(fake_project)
