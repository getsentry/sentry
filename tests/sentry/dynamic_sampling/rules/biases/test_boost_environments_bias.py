from unittest.mock import MagicMock, patch

import pytest

from sentry.dynamic_sampling import ENVIRONMENT_GLOBS, BoostEnvironmentsRulesGenerator
from sentry.dynamic_sampling.rules.biases.boost_environments_bias import (
    BoostEnvironmentsRulesGeneratorV2,
)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.biases.boost_environments_bias.BoostEnvironmentsDataProvider")
def test_generate_bias_rules(data_provider, default_project):
    rule_id = 1002

    data_provider.get_bias_data.return_value = {
        "id": rule_id,
    }

    rules = BoostEnvironmentsRulesGenerator(data_provider).generate_bias_rules(MagicMock())
    assert rules == [
        {
            "active": True,
            "condition": {
                "inner": [
                    {
                        "name": "trace.environment",
                        "op": "glob",
                        "options": {"ignoreCase": True},
                        "value": ENVIRONMENT_GLOBS,
                    }
                ],
                "op": "or",
            },
            "id": rule_id,
            "sampleRate": 1,
            "type": "trace",
        }
    ]


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.biases.boost_environments_bias.BoostEnvironmentsDataProvider")
def test_generate_bias_rules_v2(data_provider, default_project):
    rule_id = 1002

    data_provider.get_bias_data.return_value = {
        "id": rule_id,
    }

    rules = BoostEnvironmentsRulesGeneratorV2(data_provider).generate_bias_rules(MagicMock())
    assert rules == [
        {
            "active": True,
            "condition": {
                "inner": [
                    {
                        "name": "trace.environment",
                        "op": "glob",
                        "options": {"ignoreCase": True},
                        "value": ENVIRONMENT_GLOBS,
                    }
                ],
                "op": "or",
            },
            "id": rule_id,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        }
    ]
