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
    KEY_TRANSACTIONS_BOOST_FACTOR,
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
    apply_dynamic_factor,
)


class BoostKeyTransactionsDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {
            "id": RESERVED_IDS[RuleType.BOOST_KEY_TRANSACTIONS_RULE],
            "factor": apply_dynamic_factor(
                bias_params.base_sample_rate, KEY_TRANSACTIONS_BOOST_FACTOR
            ),
            "keyTransactions": get_key_transactions(bias_params.project),
        }


class BoostKeyTransactionsRulesGenerator(BiasRulesGenerator):
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
                "id": bias_data["id"],
            }
        ]


class BoostKeyTransactionsBias(Bias):
    def __init__(self) -> None:
        super().__init__(BoostKeyTransactionsDataProvider, BoostKeyTransactionsRulesGenerator)
