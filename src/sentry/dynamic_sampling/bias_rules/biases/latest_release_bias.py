from typing import Any, List

from sentry.dynamic_sampling.bias_rules.common import BiasDataProvider, BiasRulesGenerator
from sentry.dynamic_sampling.utils import BaseRule


class LatestReleaseDataProvider(BiasDataProvider):
    def get_bias_data(self) -> Any:
        return []


class LatestReleaseRulesGenerator(BiasRulesGenerator):
    def __init__(self, data_provider):
        super().__init__(data_provider)

    def generate_bias_rules(self) -> List[BaseRule]:
        return []
