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
    KEY_TRANSACTION_BOOST_FACTOR,
    RESERVED_IDS,
    BaseRule,
    RuleType,
)


class BoostKeyTransactionsDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {
            "id": RESERVED_IDS[RuleType.BOOST_KEY_TRANSACTIONS_RULE],
            "sampleRate": min(1.0, bias_params.base_sample_rate * KEY_TRANSACTION_BOOST_FACTOR),
            "keyTransactions": get_key_transactions(bias_params.project),
        }


class BoostKeyTransactionsRulesGenerator(BiasRulesGenerator):
    def _generate_bias_rules(self, bias_data: BiasData) -> List[BaseRule]:
        if len(bias_data["keyTransactions"]) == 0:
            return []

        return [
            {
                "sampleRate": bias_data["sampleRate"],
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


class BoostKeyTransactionsBias(Bias):
    def __init__(self) -> None:
        super().__init__(BoostKeyTransactionsDataProvider, BoostKeyTransactionsRulesGenerator)
