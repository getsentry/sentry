from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import (
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
    generate_cache_key_adj_factor,
    get_redis_client_for_ds,
)
from sentry.models import Project


class AdjustmentFactorBias(Bias):
    """
    Correction bias to correct distance between desired sample rate and actual sample rate.
    """

    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        prev_factor = 1.0

        redis_client = get_redis_client_for_ds()
        adj_factor_cache_key = generate_cache_key_adj_factor(project.organization.id)
        try:
            prev_factor = float(redis_client.hget(adj_factor_cache_key, project.id))
        except (TypeError, ValueError):
            pass

        if prev_factor != 1.0:
            return [
                {
                    "samplingValue": {"type": "factor", "value": prev_factor},
                    "type": "trace",
                    "condition": {
                        "op": "and",
                        "inner": [],
                    },
                    "id": RESERVED_IDS[RuleType.ADJUSTMENT_FACTOR_RULE],
                }
            ]
        return []
