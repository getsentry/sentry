from abc import ABC, abstractmethod
from typing import Dict, OrderedDict

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.utils import RuleType


class OrderedBias:
    """
    Internal representation of a bias which has a discriminant that defines a total order between itself and other
    ordered biases.
    """

    def __init__(self, bias: Bias, order_discriminant: float):
        self.bias = bias
        self.order_discriminant = order_discriminant


class BiasesCombinator(ABC):
    def __init__(self):
        self.biases: Dict[RuleType, OrderedBias] = {}

    def combine(self, rule_type: RuleType, bias: Bias) -> None:
        # We assign to this bias an order discriminant, which can be leveraged by the get_combined_biases to
        # return an ordered dictionary following a defined total order.
        self.biases[rule_type] = OrderedBias(bias, self.get_next_order_discriminant())

    @abstractmethod
    def get_next_order_discriminant(self) -> int:
        raise NotImplementedError

    @abstractmethod
    def get_combined_biases(self) -> OrderedDict[RuleType, Bias]:
        raise NotImplementedError
