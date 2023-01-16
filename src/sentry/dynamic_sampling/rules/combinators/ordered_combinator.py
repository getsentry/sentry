import collections
from typing import OrderedDict

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.combinators.base import BiasesCombinator
from sentry.dynamic_sampling.rules.utils import RuleType


class OrderedBiasesCombinator(BiasesCombinator):
    def __init__(self) -> None:
        super().__init__()
        self.order_discriminant = 0

    def get_next_order_number(self) -> int:
        order_discriminant = self.order_discriminant
        self.order_discriminant += 1
        return order_discriminant

    def get_combined_biases(self) -> OrderedDict[RuleType, Bias]:
        ordered_biases = list(sorted(self.biases.items(), key=lambda elem: elem[1].order_number))
        biases = map(lambda elem: (elem[0], elem[1].bias), ordered_biases)
        return collections.OrderedDict(biases)
