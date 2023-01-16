from unittest.mock import MagicMock, patch

import pytest

from sentry.dynamic_sampling import BoostKeyTransactionsRulesGenerator


@pytest.mark.django_db
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias.BoostKeyTransactionsDataProvider"
)
def test_generate_bias_rules(data_provider, default_project):
    rule_id = 1002
    sample_rate = 0.8
    key_transactions = ["/foo", "/bar"]

    data_provider.get_bias_data.return_value = {
        "id": rule_id,
        "sampleRate": sample_rate,
        "keyTransactions": key_transactions,
    }

    rules = BoostKeyTransactionsRulesGenerator(data_provider).generate_bias_rules(MagicMock())
    assert rules == [
        {
            "active": True,
            "condition": {
                "inner": [
                    {
                        "name": "event.transaction",
                        "op": "eq",
                        "options": {"ignoreCase": True},
                        "value": key_transactions,
                    }
                ],
                "op": "or",
            },
            "id": rule_id,
            "sampleRate": sample_rate,
            "type": "transaction",
        }
    ]


@pytest.mark.django_db
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias.BoostKeyTransactionsDataProvider"
)
def test_generate_bias_rules_with_no_key_transactions(data_provider, default_project):
    data_provider.get_bias_data.return_value = {
        "id": 1002,
        "sampleRate": 0.8,
        "keyTransactions": [],
    }

    rules = BoostKeyTransactionsRulesGenerator(data_provider).generate_bias_rules(MagicMock())
    assert rules == []
