from collections.abc import Callable

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import RuleType


class OrderedBiasesCombinator:
    def __init__(self) -> None:
        self.biases: dict[RuleType, Bias] = {}

    def add_if(self, rule_type: RuleType, bias: Bias, block: Callable[[], bool]) -> None:
        if block():
            self.add(rule_type, bias)

    def add(self, rule_type: RuleType, bias: Bias) -> None:
        self.biases[rule_type] = bias
