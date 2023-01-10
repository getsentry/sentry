from typing import List

from sentry.dynamic_sampling.rules.biases.base import (
    Bias,
    BiasData,
    BiasDataProvider,
    BiasParams,
    BiasRulesGenerator,
)
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, BaseRule, RuleType


class UniformDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {
            "id": RESERVED_IDS[RuleType.UNIFORM_RULE],
            "sampleRate": bias_params.base_sample_rate,
        }


class UniformRulesGenerator(BiasRulesGenerator):
    def _generate_bias_rules(self, bias_data: BiasData) -> List[BaseRule]:
        return [
            {
                "sampleRate": bias_data["sampleRate"],
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [],
                },
                "id": bias_data["id"],
            }
        ]


class UniformBias(Bias):
    def __init__(self) -> None:
        super().__init__(UniformDataProvider, UniformRulesGenerator)
