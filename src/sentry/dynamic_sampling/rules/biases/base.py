from abc import ABC, abstractmethod
from collections import namedtuple
from typing import Any, Dict, List, Type

from sentry.dynamic_sampling.rules.utils import BaseRule

BiasData = Dict[str, Any]
BiasParams = namedtuple("BiasParams", "project base_sample_rate")


class BiasDataProvider(ABC):
    @abstractmethod
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        raise NotImplementedError


class BiasRulesGenerator(ABC):
    def __init__(self, data_provider: BiasDataProvider):
        self.data_provider = data_provider

    def generate_bias_rules(self, bias_params: BiasParams) -> List[BaseRule]:
        return self._generate_bias_rules(self.data_provider.get_bias_data(bias_params))

    @abstractmethod
    def _generate_bias_rules(self, bias_data: BiasData) -> List[BaseRule]:
        raise NotImplementedError


class Bias(ABC):
    def __init__(
        self,
        data_provider_cls: Type[BiasDataProvider],
        rules_generator_cls: Type[BiasRulesGenerator],
    ):
        self.data_provider = data_provider_cls()
        self.rules_generator = rules_generator_cls(self.data_provider)

    def get_rules(self, bias_params: BiasParams) -> List[BaseRule]:
        return self.rules_generator.generate_bias_rules(bias_params)
