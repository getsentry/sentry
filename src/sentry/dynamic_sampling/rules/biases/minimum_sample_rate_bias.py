from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, RuleType
from sentry.models.project import Project


class MinimumSampleRateBias(Bias):
    """
    Sets the minimum sample rate for the project.
    """

    def generate_rules(self, project: Project, base_sample_rate: float) -> list[PolymorphicRule]:
        return [
            {
                "samplingValue": {"type": "minimumSampleRate", "value": base_sample_rate},
                "type": "transaction",
                "condition": {
                    "inner": [],
                    "op": "and",
                },
                "id": RESERVED_IDS[RuleType.MINIMUM_SAMPLE_RATE_RULE],
            }
        ]
