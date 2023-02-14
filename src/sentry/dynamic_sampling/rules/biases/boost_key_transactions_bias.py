from typing import List

from sentry.dynamic_sampling.rules.biases.base import (
    Bias,
    BiasData,
    BiasDataProvider,
    BiasParams,
    BiasRulesGenerator,
)
from sentry.dynamic_sampling.rules.helpers.key_transactions import get_key_transactions
from sentry.dynamic_sampling.rules.utils import (
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
    eval_dynamic_factor,
)


class BoostKeyTransactionsDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {
            "id": RESERVED_IDS[RuleType.BOOST_KEY_TRANSACTIONS_RULE],
            "factor": eval_dynamic_factor(bias_params.base_sample_rate, 1.5),
            "keyTransactions": get_key_transactions(bias_params.project),
        }


class BoostKeyTransactionsRulesGeneratorV2(BiasRulesGenerator):
    def _generate_bias_rules(self, bias_data: BiasData) -> List[PolymorphicRule]:
        if len(bias_data["keyTransactions"]) == 0:
            return []

        return [
            {
                "samplingValue": {
                    "type": "factor",
                    "value": bias_data["factor"],
                },
                "type": "transaction",
                "condition": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "eq",
                            "name": "event.transaction",
                            "value": bias_data["keyTransactions"],
                            "options": {"ignoreCase": True},
                        }
                    ],
                },
                "active": True,
                "id": bias_data["id"],
            }
        ]


class BoostKeyTransactionsBiasV2(Bias):
    def __init__(self) -> None:
        super().__init__(BoostKeyTransactionsDataProvider, BoostKeyTransactionsRulesGeneratorV2)
