from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, RuleType
from sentry.models.project import Project


class BoostLowVolumeProjectsBias(Bias):
    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        return [
            {
                "samplingValue": {
                    "type": "sampleRate",
                    "value": base_sample_rate,
                },
                "type": "trace",
                "condition": {
                    "op": "and",
                    "inner": [],
                },
                "id": RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE],
            }
        ]
