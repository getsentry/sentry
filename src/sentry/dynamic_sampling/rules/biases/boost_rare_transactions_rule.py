from typing import List

from sentry.dynamic_sampling.rules.biases.base import (
    Bias,
    BiasData,
    BiasDataProvider,
    BiasParams,
    BiasRulesGenerator,
)
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    get_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, Rule, RuleType


class RareTransactionsDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {"project": bias_params.project, "sample_rate": bias_params.base_sample_rate}


class RareTransactionsRulesGenerator(BiasRulesGenerator):
    def _generate_bias_rules(self, bias_data: BiasData) -> List[PolymorphicRule]:
        project = bias_data["project"]
        sample_rate = bias_data["sample_rate"]
        proj_id = project.id
        org_id = project.organization.id
        transaction_map, rate = get_transactions_resampling_rates(
            org_id=org_id, proj_id=proj_id, default_rate=sample_rate
        )
        ret_val: List[Rule] = []

        if len(transaction_map) == 0:
            return ret_val  # no point returning any rules the project rule should take over

        idx = 0
        for name, transaction_rate in transaction_map.items():
            if sample_rate != 0:
                transaction_rate /= sample_rate
            # add a rule for each rebalanced transaction
            ret_val.append(
                {
                    "samplingValue": {
                        "type": "factor",
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
                    "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS] + idx,
                }
            )
            idx += 1
        return ret_val


class RareTransactionsRulesBias(Bias):
    def __init__(self) -> None:
        super().__init__(RareTransactionsDataProvider, RareTransactionsRulesGenerator)
