from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import (
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
    generate_cache_key_rebalance_factor,
    get_redis_client_for_ds,
)
from sentry.models import Project


class RecalibrationBias(Bias):
    """
    Correction bias that tries to bring the overall sampling rate for the organisation to the
    desired sampling rate.

    Various biases boost and shrink different transactions in order to obtain an appropriate
    number of samples from all areas of the application, doing this changes the overall sampling
    rate from the desired sampling rate, this bias tries to rectify the overall organisation sampling
    rate and bring it to the desired sampling rate,it uses the previous interval rate to figure out
    how this should be done.
    """

    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        factor = 1.0

        redis_client = get_redis_client_for_ds()
        adj_factor_cache_key = generate_cache_key_rebalance_factor(project.organization.id)
        try:
            factor = float(redis_client.get(adj_factor_cache_key))
        except (TypeError, ValueError):
            pass

        if factor != 1.0:
            return [
                {
                    "samplingValue": {"type": "factor", "value": factor},
                    "type": "trace",
                    "condition": {
                        "op": "and",
                        "inner": [],
                    },
                    "id": RESERVED_IDS[RuleType.RECALIBRATION_RULE],
                }
            ]
        return []
