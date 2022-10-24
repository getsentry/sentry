<<<<<<< HEAD
from sentry.dynamic_sampling.rules_generator import generate_environment_rule, generate_uniform_rule
||||||| parent of 1f195d7423 (fixup!)
from unittest.mock import MagicMock, patch

import pytest

from sentry.dynamic_sampling.utils import NoneSampleRateException, generate_uniform_rule
=======
from unittest.mock import MagicMock, patch

import pytest

from sentry.dynamic_sampling.utils import (
    NoneSampleRateException,
    generate_environment_rule,
    generate_uniform_rule,
)
>>>>>>> 1f195d7423 (fixup!)


def test_generate_uniform_rule_return_rate():
    sample_rate = 0.1
    assert generate_uniform_rule(sample_rate) == {
        "active": True,
        "condition": {"inner": [], "op": "and"},
        "id": 1000,
        "sampleRate": sample_rate,
        "type": "trace",
    }


<<<<<<< HEAD
def test_generate_environment_rule():
    bias_env_rule = generate_environment_rule()
    assert bias_env_rule["id"] == 1001
    assert bias_env_rule["condition"]["inner"][0] == {
        "op": "glob",
        "name": "trace.environment",
        "value": ["*dev*", "*test*"],
        "options": {"ignoreCase": True},
    }
||||||| parent of 1f195d7423 (fixup!)
@patch("sentry.dynamic_sampling.utils.quotas.get_blended_sample_rate")
def test_generate_uniform_rule_raise_exception(get_blended_sample_rate):
    get_blended_sample_rate.return_value = None
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    with pytest.raises(NoneSampleRateException):
        generate_uniform_rule(fake_project)
    get_blended_sample_rate.assert_called_with(fake_project)
=======
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
>>>>>>> 1f195d7423 (fixup!)
