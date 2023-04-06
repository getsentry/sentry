from unittest.mock import MagicMock, patch

from sentry.dynamic_sampling import RESERVED_IDS, RuleType
from sentry.dynamic_sampling.rules.biases.boost_rare_transactions_rule import (
    RareTransactionsRulesBias,
)


def _create_mocks():
    proj_id = 22
    org_id = 23

    org = MagicMock()
    org.id = org_id
    proj = MagicMock()
    proj.id = proj_id

    proj.organization = org

    def get_transactions_resampling_rates(org_id, proj_id, default_rate):
        if org_id == org.id and proj_id == proj.id:
            return {
                "t1": 0.1,
                "t2": 0.2,
            }, 0.01
        return {}, default_rate

    return proj, get_transactions_resampling_rates


@patch(
    "sentry.dynamic_sampling.rules.biases.boost_rare_transactions_rule.get_transactions_resampling_rates"
)
def test_transaction_boost_known_projects(get_transactions_resampling_rates):
    """
    Test that when there is information available about project transactions it
    generates rules for boosting rare transactions
    """
    project, fake_get_trans_res_rates = _create_mocks()
    rate = 0.2
    get_transactions_resampling_rates.side_effect = fake_get_trans_res_rates

    rules = RareTransactionsRulesBias().generate_rules(project=project, base_sample_rate=rate)
    expected = [
        {
            "samplingValue": {"type": "factor", "value": 0.1 / rate},
            "type": "transaction",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "eq",
                        "name": "event.transaction",
                        "value": ["t1"],
                        "options": {"ignoreCase": True},
                    }
                ],
            },
            "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS],
        },
        {
            "samplingValue": {"type": "factor", "value": 0.2 / rate},
            "type": "transaction",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "eq",
                        "name": "event.transaction",
                        "value": ["t2"],
                        "options": {"ignoreCase": True},
                    }
                ],
            },
            "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS] + 1,
        },
        {
            "samplingValue": {"type": "factor", "value": 0.01 / rate},
            "type": "transaction",
            "condition": {
                "op": "and",
                "inner": [
                    {
                        "op": "not",
                        "inner": {
                            "name": "event.transaction",
                            "op": "eq",
                            "options": {"ignoreCase": True},
                            "value": ["t1"],
                        },
                    },
                    {
                        "op": "not",
                        "inner": {
                            "name": "event.transaction",
                            "op": "eq",
                            "options": {"ignoreCase": True},
                            "value": ["t2"],
                        },
                    },
                ],
            },
            "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS] + 2,
        },
    ]
    assert rules == expected


def test_transaction_boost_unknown_projects():
    """
    Tests that when there is no information available for the project transactions
    it returns an empty set of rules.
    """
    project, fake_get_trans_res_rates = _create_mocks()
    rate = 0.2

    rules = RareTransactionsRulesBias().generate_rules(project=project, base_sample_rate=rate)
    assert rules == []
