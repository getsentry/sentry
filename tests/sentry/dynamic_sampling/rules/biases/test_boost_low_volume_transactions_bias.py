from unittest.mock import MagicMock, patch

from sentry.dynamic_sampling import RESERVED_IDS, RuleType
from sentry.dynamic_sampling.rules.biases.boost_low_volume_transactions_bias import (
    BoostLowVolumeTransactionsBias,
)


def _create_mocks():
    proj_id = 22
    org_id = 23

    org = MagicMock()
    org.id = org_id
    proj = MagicMock()
    proj.id = proj_id

    proj.organization = org

    explicit_rates = {"t1": 0.1, "t2": 0.2}
    implicit_rate = 0.01

    def get_transactions_resampling_rates(org_id, proj_id, default_rate):
        if org_id == org.id and proj_id == proj.id:
            return explicit_rates, implicit_rate
        return {}, default_rate

    return proj, get_transactions_resampling_rates, explicit_rates, implicit_rate


@patch(
    "sentry.dynamic_sampling.rules.biases.boost_low_volume_transactions_bias.get_transactions_resampling_rates"
)
def test_transaction_boost_known_projects(get_transactions_resampling_rates):
    """
    Test that when there is information available about project transactions it
    generates rules for boosting low volume transactions
    """
    project, fake_get_trans_res_rates, explicit_rates, implicit_rate = _create_mocks()
    rate = 0.2
    get_transactions_resampling_rates.side_effect = fake_get_trans_res_rates

    # the raw rates
    t1_rate = explicit_rates["t1"]
    t2_rate = explicit_rates["t2"]

    # adjusted factors
    implicit_factor = implicit_rate / rate
    t1_factor = t1_rate / rate / implicit_factor
    t2_factor = t2_rate / rate / implicit_factor

    rules = BoostLowVolumeTransactionsBias().generate_rules(project=project, base_sample_rate=rate)
    expected = [
        {
            "samplingValue": {"type": "factor", "value": t1_factor},
            "type": "trace",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "eq",
                        "name": "trace.transaction",
                        "value": ["t1"],
                        "options": {"ignoreCase": True},
                    }
                ],
            },
            "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE],
        },
        {
            "samplingValue": {"type": "factor", "value": t2_factor},
            "type": "trace",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "eq",
                        "name": "trace.transaction",
                        "value": ["t2"],
                        "options": {"ignoreCase": True},
                    }
                ],
            },
            "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE] + 1,
        },
        {
            "samplingValue": {"type": "factor", "value": implicit_factor},
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [],
            },
            "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE] + 2,
        },
    ]
    assert rules == expected


def test_transaction_boost_unknown_projects():
    """
    Tests that when there is no information available for the project transactions
    it returns an empty set of rules.
    """
    project, fake_get_trans_res_rates, _explicit_rates, _implicit_rate = _create_mocks()
    rate = 0.2

    rules = BoostLowVolumeTransactionsBias().generate_rules(project=project, base_sample_rate=rate)
    assert rules == []
