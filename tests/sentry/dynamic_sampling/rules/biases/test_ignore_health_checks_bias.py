from unittest.mock import MagicMock, patch

import pytest

from sentry.dynamic_sampling import IgnoreHealthChecksRulesGenerator


@pytest.mark.django_db
@patch(
    "sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias.IgnoreHealthChecksDataProvider"
)
def test_generate_bias_rules(data_provider, default_project):
    rule_id = 1001
    sample_rate = 1.0
    health_check_globs = ["/health", "/healtz", "/*health*"]

    data_provider.get_bias_data.return_value = {
        "id": rule_id,
        "sampleRate": sample_rate,
        "healthCheckGlobs": health_check_globs,
    }

    rules = IgnoreHealthChecksRulesGenerator(data_provider).generate_bias_rules(MagicMock())
    assert rules == [
        {
            "active": True,
            "condition": {
                "inner": [
                    {
                        "name": "event.transaction",
                        "op": "glob",
                        "options": {"ignoreCase": True},
                        "value": health_check_globs,
                    }
                ],
                "op": "or",
            },
            "id": rule_id,
            "sampleRate": sample_rate,
            "type": "transaction",
        }
    ]
