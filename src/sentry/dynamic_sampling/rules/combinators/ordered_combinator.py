from typing import List

from sentry.dynamic_sampling.rules.biases.base import BiasParams
from sentry.dynamic_sampling.rules.combinators.base import BiasesRulesCombinator
from sentry.dynamic_sampling.utils import BaseRule


class OrderedRulesCombinator(BiasesRulesCombinator):
    def get_combined_rules(self) -> List[BaseRule]:
        # Here we can return the ordered list of biases in order to have a
        # deterministic order that coincides with the cascading calls to "combine".
        rules = []

        for bias in self.biases:
            rules += bias.get_rules(BiasParams(self.project, self.base_sample_rate))

        return rules
