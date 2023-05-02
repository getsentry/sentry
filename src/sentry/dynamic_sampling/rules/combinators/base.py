from abc import ABC, abstractmethod
from typing import Callable, Dict, OrderedDict

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import RuleType


class OrderedBias:
    """
    Internal representation of a bias which has an order number that defines the total order between other ordered
    biases.
    """

    def __init__(self, bias: Bias, order_number: float):
        self.bias = bias
        self.order_number = order_number


class BiasesCombinator(ABC):
    """
    Base class representing a way to define total order between biases.

    The need of this class arises as there is the need to be explicit w.r.t to the ordering semantics of the biases.
    """

    def __init__(self) -> None:
        self.biases: Dict[RuleType, OrderedBias] = {}

    def add_if(self, rule_type: RuleType, bias: Bias, block: Callable[[], bool]) -> None:
        if block():
            self.add(rule_type, bias)

    def add(self, rule_type: RuleType, bias: Bias) -> None:
        # We assign to this bias an order discriminant, which can be leveraged by the get_combined_biases to
        # return an ordered dictionary following a defined total order.
        self.biases[rule_type] = OrderedBias(bias, self.get_next_order_number())

    @abstractmethod
    def get_next_order_number(self) -> int:
        raise NotImplementedError

    @abstractmethod
    def get_combined_biases(self) -> OrderedDict[RuleType, Bias]:
        raise NotImplementedError
