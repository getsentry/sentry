from unittest.mock import MagicMock, patch

import pytest

from sentry.dynamic_sampling.utils import (
    NoneSampleRateException,
    generate_environment_rule,
    generate_uniform_rule,
)


@patch("sentry.dynamic_sampling.utils.quotas.get_blended_sample_rate")
def test_generate_uniform_rule_return_rate(get_blended_sample_rate):
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    assert generate_uniform_rule(fake_project) == {
        "active": True,
        "condition": {"inner": [], "op": "and"},
        "id": 0,
        "sampleRate": 0.1,
        "type": "trace",
    }
    get_blended_sample_rate.assert_called_with(fake_project)


@patch("sentry.dynamic_sampling.utils.quotas.get_blended_sample_rate")
def test_generate_uniform_rule_raise_exception(get_blended_sample_rate):
    get_blended_sample_rate.return_value = None
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    with pytest.raises(NoneSampleRateException):
        generate_uniform_rule(fake_project)
    get_blended_sample_rate.assert_called_with(fake_project)


def test_generate_environment_rule():
    bias_env_rule = generate_environment_rule()
    assert bias_env_rule["id"] == 1
    assert bias_env_rule["condition"]["inner"][0] == {
        "op": "glob",
        "name": "trace.environment",
        "value": ["*dev*", "*test*"],
        "options": {"ignoreCase": True},
    }
