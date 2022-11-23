from typing import List

from sentry.dynamic_sampling.bias_rules import BiasRulesCombinator
from sentry.dynamic_sampling.utils import BaseRule


class RelayBiasRulesCombinator(BiasRulesCombinator):
    def get_combined_rules(self) -> List[BaseRule]:
        return []
