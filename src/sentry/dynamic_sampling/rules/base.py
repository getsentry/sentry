from typing import List, Optional, Set

import sentry_sdk

from sentry import quotas
from sentry.dynamic_sampling.rules.biases import (
    BOOST_ENVIRONMENTS_BIAS,
    IGNORE_HEALTH_CHECKS_BIAS,
    UNIFORM_BIAS,
)
from sentry.dynamic_sampling.rules.combinators import OrderedRulesCombinator
from sentry.dynamic_sampling.rules.combinators.base import BiasesRulesCombinator
from sentry.dynamic_sampling.utils import BaseRule, RuleType
from sentry.models import Project


def _get_blended_sample_rate(project: Project) -> float:
    return quotas.get_blended_sample_rate(project)


def get_guarded_blended_sample_rate(project: Project) -> float:
    sample_rate = _get_blended_sample_rate(project)

    if sample_rate is None:
        raise Exception("The method get_blended_sample_rate() returned None")

    return sample_rate


class DynamicSamplingRulesGenerator:
    def __init__(self, combinator: BiasesRulesCombinator):
        self.combinator = combinator

    @classmethod
    def from_enabled_biases(
        cls, project: Project, enabled_biases: Set[str]
    ) -> Optional["DynamicSamplingRulesGenerator"]:
        try:
            base_sample_rate = get_guarded_blended_sample_rate(project)
            instance = cls(OrderedRulesCombinator(project, base_sample_rate))

            def dynamic_sampling_enabled():
                # If the customer has a base sample rate of 100% it means that we don't want to activate biases which
                # means that dynamic sampling is not enabled (technically it is enabled, but logically it is
                # indistinguishable from disabled).
                return base_sample_rate < 1.0

            if RuleType.BOOST_ENVIRONMENTS_RULE.value in enabled_biases:
                instance.combinator.combine_if(BOOST_ENVIRONMENTS_BIAS, dynamic_sampling_enabled)

            if RuleType.IGNORE_HEALTH_CHECKS_RULE.value in enabled_biases:
                instance.combinator.combine_if(IGNORE_HEALTH_CHECKS_BIAS, dynamic_sampling_enabled)

            # Add the uniform bias as the last rule so that because we use an ordered combinator we know it will be
            # combined as last.
            instance.combinator.combine(UNIFORM_BIAS)

            return instance
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return None

    def generate(self) -> List[BaseRule]:
        return self.combinator.get_combined_rules()
