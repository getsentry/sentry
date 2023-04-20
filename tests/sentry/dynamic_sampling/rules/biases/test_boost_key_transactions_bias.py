from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias import (
    BoostKeyTransactionsBias,
)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias.get_key_transactions")
def test_generate_bias_rules_v2(get_key_transactions, default_project):
    key_transactions = ["/foo", "/bar"]
    get_key_transactions.return_value = key_transactions

    rules = BoostKeyTransactionsBias().generate_rules(default_project, base_sample_rate=0.0)
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
            "id": 1003,
            "samplingValue": {"type": "factor", "value": 1.5},
            "type": "transaction",
        }
    ]


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias.get_key_transactions")
def test_generate_bias_rules_with_no_key_transactions(get_key_transactions, default_project):
    key_transactions = []
    get_key_transactions.return_value = key_transactions

    rules = BoostKeyTransactionsBias().generate_rules(project=default_project, base_sample_rate=0.0)
    assert rules == []
