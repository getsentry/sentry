from unittest.mock import MagicMock, patch

import pytest

from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import IgnoreHealthChecksBias


@pytest.mark.django_db
@patch(
    "sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias.IgnoreHealthChecksDataProvider"
)
def test_generate_bias_rules_v2(data_provider, default_project):
    rule_id = 1001
    sample_rate = 1.0
    health_check_globs = ["/health", "/healtz", "/*health*"]

    data_provider.get_bias_data.return_value = {
        "id": rule_id,
        "sampleRate": sample_rate,
        "healthCheckGlobs": health_check_globs,
    }

    rules = IgnoreHealthChecksBias(data_provider).generate_rules(MagicMock())
    assert rules == [
        {
            "condition": {
                "inner": [
                    {
                        "name": "event.transaction",
                        "op": "glob",
                        "value": health_check_globs,
                    }
                ],
                "op": "or",
            },
            "id": rule_id,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "transaction",
        }
    ]
