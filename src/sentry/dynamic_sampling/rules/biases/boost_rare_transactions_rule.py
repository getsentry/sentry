from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    get_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, Rule, RuleType
from sentry.models import Project


class RareTransactionsRulesBias(Bias):
    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        proj_id = project.id
        org_id = project.organization.id
        transaction_map, implicit_rate = get_transactions_resampling_rates(
            org_id=org_id, proj_id=proj_id, default_rate=base_sample_rate
        )
        ret_val: List[Rule] = []

        if len(transaction_map) == 0:
            return ret_val  # no point returning any rules the project rule should take over

        idx = 0
        implicit_rate_condition = []
        for name, transaction_rate in transaction_map.items():
            if base_sample_rate != 0:
                transaction_rate /= base_sample_rate
            # add a rule for each rebalanced transaction
            condition = {
                "op": "eq",
                "name": "event.transaction",
                "value": [name],
                "options": {"ignoreCase": True},
            }
            ret_val.append(
                {
                    "samplingValue": {
                        "type": "factor",
                        "value": transaction_rate,
                    },
                    "type": "transaction",
                    "condition": {
                        "op": "or",
                        "inner": [condition],
                    },
                    "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS] + idx,
                }
            )

            implicit_rate_condition.append({"op": "not", "inner": condition})
            idx += 1
        if base_sample_rate != 0:
            rate = implicit_rate / base_sample_rate
            ret_val.append(
                {
                    "samplingValue": {
                        "type": "factor",
                        "value": rate,
                    },
                    "type": "transaction",
                    "condition": {
                        "op": "and",
                        "inner": implicit_rate_condition,
                    },
                    "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS] + idx,
                }
            )

        return ret_val
