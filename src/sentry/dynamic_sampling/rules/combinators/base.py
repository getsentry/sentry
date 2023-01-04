from abc import ABC, abstractmethod
from typing import Callable, List

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.utils import BaseRule
from sentry.models import Project


class BiasesRulesCombinator(ABC):
    def __init__(self, project: Project, base_sample_rate: float):
        self.project = project
        self.base_sample_rate = base_sample_rate
        self.biases: List[Bias] = []

    def combine_if(self, bias: Bias, block: Callable[[], bool]) -> "BiasesRulesCombinator":
        # This condition is required because a bias cannot be used if a customer has 100% base sample rate. In that
        # case only the uniform condition can be applied.
        if block():
            self.biases.append(bias)

        return self

    def combine(self, bias: Bias) -> "BiasesRulesCombinator":
        self.biases.append(bias)
        return self

    @abstractmethod
    def get_combined_rules(self) -> List[BaseRule]:
        raise NotImplementedError
