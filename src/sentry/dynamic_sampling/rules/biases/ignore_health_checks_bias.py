from typing import List

from sentry.dynamic_sampling.rules.biases.base import (
    Bias,
    BiasData,
    BiasDataProvider,
    BiasParams,
    BiasRulesGenerator,
)
from sentry.dynamic_sampling.rules.utils import (
    IGNORE_HEALTH_CHECKS_FACTOR,
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
)

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


class IgnoreHealthChecksDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {
            "id": RESERVED_IDS[RuleType.IGNORE_HEALTH_CHECKS_RULE],
            "sampleRate": bias_params.base_sample_rate / IGNORE_HEALTH_CHECKS_FACTOR,
            "healthCheckGlobs": HEALTH_CHECK_GLOBS,
        }


class IgnoreHealthChecksRulesGenerator(BiasRulesGenerator):
    def _generate_bias_rules(self, bias_data: BiasData) -> List[PolymorphicRule]:
        return [
            {
                "samplingValue": {"type": "sampleRate", "value": bias_data["sampleRate"]},
                "type": "transaction",
                "condition": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "glob",
                            "name": "event.transaction",
                            "value": bias_data["healthCheckGlobs"],
                        }
                    ],
                },
                "id": bias_data["id"],
            }
        ]


class IgnoreHealthChecksBias(Bias):
    def __init__(self) -> None:
        super().__init__(IgnoreHealthChecksDataProvider, IgnoreHealthChecksRulesGenerator)
