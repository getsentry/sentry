from typing import List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import (
    IGNORE_HEALTH_CHECKS_FACTOR,
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
)
from sentry.models import Project

# https://kubernetes.io/docs/reference/using-api/health-checks/
# Also it covers: livez, readyz
HEALTH_CHECK_GLOBS = [
    "*healthcheck*",
    "*healthy*",
    "*live*",
    "*ready*",
    "*heartbeat*",
    "*/health",
    "*/healthz",
]


class IgnoreHealthChecksBias(Bias):
    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        return [
            {
                "samplingValue": {
                    "type": "sampleRate",
                    "value": base_sample_rate / IGNORE_HEALTH_CHECKS_FACTOR,
                },
                "type": "transaction",
                "condition": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "glob",
                            "name": "event.transaction",
                            "value": HEALTH_CHECK_GLOBS,
                        }
                    ],
                },
                "id": RESERVED_IDS[RuleType.IGNORE_HEALTH_CHECKS_RULE],
            }
        ]
