from abc import ABC, abstractmethod
from typing import Any, List, Type

from sentry.dynamic_sampling.utils import BaseRule


class BiasDataProvider(ABC):
    @staticmethod
    def get_blended_sample_rate() -> float:
        return 1.0

    @abstractmethod
    def get_bias_data(self) -> Any:
        raise NotImplementedError()


class BiasRulesGenerator(ABC):
    def __init__(self, data_provider):
        self.data_provider = data_provider

    @abstractmethod
    def generate_bias_rules(self) -> List[BaseRule]:
        raise NotImplementedError()


class Bias(ABC):
    def __init__(
        self, data_provider: Type[BiasDataProvider], rules_generator: Type[BiasRulesGenerator]
    ):
        self.rules_generator = rules_generator(data_provider())

    def get_rules(self) -> List[BaseRule]:
        return self.rules_generator.generate_bias_rules()


class BiasRulesCombinator(ABC):
    def __init__(self):
        self.biases = []

    def combine(self, bias: Bias) -> "BiasRulesCombinator":
        self.biases.append(bias)
        return self

    @abstractmethod
    def get_combined_rules(self) -> List[BaseRule]:
        raise NotImplementedError()
