import pytest

from sentry.dynamic_sampling import ENVIRONMENT_GLOBS
from sentry.dynamic_sampling.rules.biases.boost_environments_bias import BoostEnvironmentsBias


@pytest.mark.django_db
def test_generate_bias_rules_v2(default_project):
    rules = BoostEnvironmentsBias().generate_rules(project=default_project, base_sample_rate=0.1)
    assert rules == [
        {
            "condition": {
                "inner": [
                    {
                        "name": "trace.environment",
                        "op": "glob",
                        "value": ENVIRONMENT_GLOBS,
                    }
                ],
                "op": "or",
            },
            "id": 1001,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        }
    ]
