from sentry.dynamic_sampling.rules_generator import generate_environment_rule, generate_uniform_rule


def test_generate_uniform_rule_return_rate():
    sample_rate = 0.1
    assert generate_uniform_rule(sample_rate) == {
        "active": True,
        "condition": {"inner": [], "op": "and"},
        "id": 1000,
        "sampleRate": sample_rate,
        "type": "trace",
    }


def test_generate_environment_rule():
    bias_env_rule = generate_environment_rule()
    assert bias_env_rule["id"] == 1001
    assert bias_env_rule["condition"]["inner"][0] == {
        "op": "glob",
        "name": "trace.environment",
        "value": ["*dev*", "*test*"],
        "options": {"ignoreCase": True},
    }
