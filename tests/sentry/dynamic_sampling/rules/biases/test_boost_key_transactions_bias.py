from unittest.mock import MagicMock, patch

import pytest

from sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias import (
    BoostKeyTransactionsBias,
)


@pytest.mark.django_db
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias.BoostKeyTransactionsDataProvider"
)
def test_generate_bias_rules_v2(data_provider, default_project):
    rule_id = 1002
    factor = 1.5
    key_transactions = ["/foo", "/bar"]

    data_provider.get_bias_data.return_value = {
        "id": rule_id,
        "factor": factor,
        "keyTransactions": key_transactions,
    }

    rules = BoostKeyTransactionsBias(data_provider).generate_rules(MagicMock())
    assert rules == [
        {
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
            "samplingValue": {"type": "factor", "value": factor},
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

    rules = BoostKeyTransactionsBias(data_provider).generate_rules(MagicMock())
    assert rules == []
