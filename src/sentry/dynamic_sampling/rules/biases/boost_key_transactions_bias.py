from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.helpers.key_transactions import get_key_transactions
from sentry.dynamic_sampling.rules.utils import (
    KEY_TRANSACTIONS_BOOST_FACTOR,
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
    apply_dynamic_factor,
)
from sentry.models import Project


class BoostKeyTransactionsBias(Bias):
    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        key_transactions = get_key_transactions(project)
        if len(key_transactions) == 0:
            return []

        return [
            {
                "samplingValue": {
                    "type": "factor",
                    "value": apply_dynamic_factor(base_sample_rate, KEY_TRANSACTIONS_BOOST_FACTOR),
                },
                "type": "transaction",
                "condition": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "eq",
                            "name": "event.transaction",
                            "value": key_transactions,
                            "options": {"ignoreCase": True},
                        }
                    ],
                },
                "id": RESERVED_IDS[RuleType.BOOST_KEY_TRANSACTIONS_RULE],
            }
        ]
