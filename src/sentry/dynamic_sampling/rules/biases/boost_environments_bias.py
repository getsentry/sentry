from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, RuleType
from sentry.models import Project

ENVIRONMENT_GLOBS = [
    "*debug*",
    "*dev*",
    "*local*",
    "*qa*",
    "*test*",
]


class BoostEnvironmentsBias(Bias):
    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        return [
            {
                "samplingValue": {
                    "type": "sampleRate",
                    "value": 1.0,
                },
                "type": "trace",
                "condition": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "glob",
                            "name": "trace.environment",
                            "value": ENVIRONMENT_GLOBS,
                        }
                    ],
                },
                "id": RESERVED_IDS[RuleType.BOOST_ENVIRONMENTS_RULE],
            }
        ]
