from typing import List

from sentry.dynamic_sampling.rules.biases.base import (
    Bias,
    BiasData,
    BiasDataProvider,
    BiasParams,
    BiasRulesGenerator,
)
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, RuleType

ENVIRONMENT_GLOBS = [
    "*dev*",
    "*test*",
    "*qa*",
    "*local*",
]


class BoostEnvironmentsDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {"id": RESERVED_IDS[RuleType.BOOST_ENVIRONMENTS_RULE]}


class BoostEnvironmentsRulesGenerator(BiasRulesGenerator):
    def _generate_bias_rules(self, bias_data: BiasData) -> List[PolymorphicRule]:
        return [
            {
                "sampleRate": 1,
                "type": "trace",
                "condition": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "glob",
                            "name": "trace.environment",
                            "value": ENVIRONMENT_GLOBS,
                            "options": {"ignoreCase": True},
                        }
                    ],
                },
                "active": True,
                "id": bias_data["id"],
            }
        ]


class BoostEnvironmentsRulesGeneratorV2(BiasRulesGenerator):
    def _generate_bias_rules(self, bias_data: BiasData) -> List[PolymorphicRule]:
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
                            "options": {"ignoreCase": True},
                        }
                    ],
                },
                "active": True,
                "id": bias_data["id"],
            }
        ]


class BoostEnvironmentsBias(Bias):
    def __init__(self) -> None:
        super().__init__(BoostEnvironmentsDataProvider, BoostEnvironmentsRulesGenerator)


class BoostEnvironmentsBiasV2(Bias):
    def __init__(self) -> None:
        super().__init__(BoostEnvironmentsDataProvider, BoostEnvironmentsRulesGeneratorV2)
