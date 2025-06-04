from sentry.constants import HEALTH_CHECK_GLOBS
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import IgnoreHealthChecksBias
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_generate_bias_rules_v2(default_project):
    rules = IgnoreHealthChecksBias().generate_rules(project=default_project, base_sample_rate=1.0)
    assert rules == [
        {
            "condition": {
                "inner": [
                    {
                        "name": "event.transaction",
                        "op": "glob",
                        "value": HEALTH_CHECK_GLOBS,
                    }
                ],
                "op": "or",
            },
            "id": 1002,
            "samplingValue": {"type": "sampleRate", "value": 0.2},
            "type": "transaction",
        }
    ]
