from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, RuleType
from sentry.models import Project


class BoostReplayIdBias(Bias):
    """
    Boosts at 100% sample rate all the traces that have a replay_id.
    """

    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        return [
            {
                "samplingValue": {"type": "sampleRate", "value": 1.0},
                "type": "trace",
                "condition": {
                    "op": "not",
                    "inner": {
                        "op": "eq",
                        "name": "trace.replay_id",
                        "value": None,
                        "options": {"ignoreCase": True},
                    },
                },
                "id": RESERVED_IDS[RuleType.BOOST_REPLAY_ID_RULE],
            }
        ]
