from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias, BiasParams
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    get_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, Rule, RuleType
from sentry.models import Project


def get_rules(project: Project, sample_rate: float) -> List[PolymorphicRule]:
    proj_id = project.id
    org_id = project.organization.id
    transaction_map, rate = get_transactions_resampling_rates(
        org_id=org_id, proj_id=proj_id, default_rate=sample_rate
    )
    ret_val: List[Rule] = []

    if len(transaction_map) == 0:
        return ret_val  # no point returning any rules the project rule should take over

    for name, transaction_rate in transaction_map.items():
        # add a rule for each rebalanced transaction
        ret_val.append(
            {
                "samplingValue": {
                    "type": "sampleRate",
                    "value": transaction_rate,
                },
                "type": "transaction",
                "condition": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "eq",
                            "name": "event.transaction",
                            "value": [name],
                            "options": {"ignoreCase": True},
                        }
                    ],
                },
                "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS],
            }
        )

    # add a rule for all other transactions:
    ret_val.append(
        {
            "samplingValue": {
                "type": "sampleRate",
                "value": rate,
            },
            "type": "transaction",
            "condition": {
                "op": "and",
                "inner": [],
            },
            "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS],
        }
    )
    return ret_val


class RareTransactionsRulesBias(Bias):
    """
    Useless adapter for Bias "infrastructure"
    """

    def __init__(self):
        pass

    def get_rules(self, bias_params: BiasParams) -> List[PolymorphicRule]:
        return get_rules(bias_params.project, bias_params.base_sample_rate)
