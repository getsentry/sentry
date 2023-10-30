from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, Rule, RuleType
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    get_transactions_resampling_rates,
)
from sentry.models.project import Project


class BoostLowVolumeTransactionsBias(Bias):
    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        proj_id = project.id
        org_id = project.organization.id

        transaction_map, base_implicit_rate = get_transactions_resampling_rates(
            org_id=org_id, proj_id=proj_id, default_rate=base_sample_rate
        )

        ret_val: List[Rule] = []

        if len(transaction_map) == 0:
            return ret_val  # no point returning any rules the project rule should take over

        if base_sample_rate == 0:
            return ret_val  # we can't deal without a base_sample_rate

        if base_implicit_rate == 0.0:
            base_implicit_rate = 1.0

        # The implicit rate that we compute is transformed to a factor, so that when the rate is multiplied by the last
        # sample rate rule, the value will be `base_implicit_rate`.
        implicit_rate = base_implicit_rate / base_sample_rate

        idx = 0
        for name, base_transaction_rate in transaction_map.items():
            # Here we apply a similar logic to above and since we expect that the resulting multiplication on the Relay
            # end will multiply transaction_rate * implicit_rate * base_sample_rate and the resulting value that we want
            # is the actual base_transaction_rate.
            #
            # This operation has been designed to be minimal since through some math we can reduce the number of
            # operations. Given:
            # s = base_sample_rate
            # i = base_implicit_rate
            # t = base_transaction_rate
            # we start with the base case for the implicit_rate, which will result in the following expression being
            # computed by Relay -> s * (i / s) = i. Now we want to extend this expression to perform a similar logic
            # but with an added term t. This would result in ((s * (i / s)) * (t / ((i / s) * s))) which can be
            # simplified to ((s * (i / s)) * (t / i))).
            transaction_rate = base_transaction_rate / base_implicit_rate

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
                        "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE] + idx,
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
                    "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE] + idx,
                }
            )

        return ret_val
