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

        if base_sample_rate == 0:
            return ret_val  # we can't deal without a base_sample_rate

        if implicit_rate == 0.0:
            implicit_rate = 1.0
        implicit_rate = implicit_rate / base_sample_rate
        idx = 0
        for name, transaction_rate in transaction_map.items():
            transaction_rate /= base_sample_rate
            # since the implicit rate applies for everything (so explicit transaction will also
            # have it applied undo its effect here so we end up with factor = (transaction_r/implicit_r) * implicit_r
            transaction_rate /= implicit_rate
            # add a rule for each rebalanced transaction
            if transaction_rate != 1.0:
                ret_val.append(
                    {
                        "samplingValue": {
                            "type": "factor",
                            "value": transaction_rate,
                        },
                        "type": "trace",
                        "condition": {
                            "op": "or",
                            "inner": [
                                {
                                    "op": "eq",
                                    "name": "trace.transaction",
                                    "value": [name],
                                    "options": {"ignoreCase": True},
                                }
                            ],
                        },
                        "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS] + idx,
                    }
                )
                idx += 1
        if implicit_rate != 1.0:
            ret_val.append(
                {
                    "samplingValue": {
                        "type": "factor",
                        "value": implicit_rate,
                    },
                    "type": "trace",
                    "condition": {
                        "op": "and",
                        "inner": [],
                    },
                    "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS] + idx,
                }
            )

        return ret_val
