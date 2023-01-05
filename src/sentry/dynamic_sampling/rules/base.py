from enum import Enum
from typing import Any, List, Optional, Set

import sentry_sdk

from sentry import quotas
from sentry.dynamic_sampling.feature_multiplexer import DynamicSamplingFeatureMultiplexer
from sentry.dynamic_sampling.logging import log_rules
from sentry.dynamic_sampling.rules.biases.boost_environments_bias import BOOST_ENVIRONMENTS_BIAS
from sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias import (
    BOOST_KEY_TRANSACTIONS_BIAS,
)
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import (
    BOOST_LATEST_RELEASES_BIAS,
)
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import IGNORE_HEALTH_CHECKS_BIAS
from sentry.dynamic_sampling.rules.biases.uniform_bias import UNIFORM_BIAS
from sentry.dynamic_sampling.rules.combinators.base import BiasesRulesCombinator
from sentry.dynamic_sampling.rules.combinators.ordered_combinator import OrderedRulesCombinator
from sentry.dynamic_sampling.utils import BaseRule, RuleType
from sentry.models import Project


def _get_blended_sample_rate(project: Project) -> float:
    # Function used for simplifying mocking in tests.
    return quotas.get_blended_sample_rate(project)  # type:ignore


def get_guarded_blended_sample_rate(project: Project) -> float:
    sample_rate = _get_blended_sample_rate(project)

    if sample_rate is None:
        raise Exception("The method get_blended_sample_rate() returned None")

    return sample_rate


class CombinatorBuildType(Enum):
    FROM_ENABLED_BIASES = 0


class DynamicSamplingBiases:
    def build_combinator(
        self, build_type: CombinatorBuildType, **kwargs: Any
    ) -> Optional[BiasesRulesCombinator]:
        if build_type == CombinatorBuildType.FROM_ENABLED_BIASES:
            return self._from_enabled_biases(**kwargs)

        return None

    @staticmethod
    def _from_enabled_biases(
        project: Project, enabled_biases: Set[str]
    ) -> Optional[BiasesRulesCombinator]:
        try:
            base_sample_rate = get_guarded_blended_sample_rate(project)
            combinator: BiasesRulesCombinator = OrderedRulesCombinator(project, base_sample_rate)

            def dynamic_sampling_enabled() -> bool:
                # If the customer has a base sample rate of 100% it means that we don't want to activate biases which
                # means that dynamic sampling is not enabled (technically it is enabled, but logically it is
                # indistinguishable from disabled).
                return base_sample_rate < 1.0

            # TODO: try to think of a more extensible implementation that guarantees deterministic ordering.
            if RuleType.BOOST_KEY_TRANSACTIONS_RULE.value in enabled_biases:
                combinator.combine_if(BOOST_KEY_TRANSACTIONS_BIAS, dynamic_sampling_enabled)

            if RuleType.BOOST_ENVIRONMENTS_RULE.value in enabled_biases:
                combinator.combine_if(BOOST_ENVIRONMENTS_BIAS, dynamic_sampling_enabled)

            if RuleType.IGNORE_HEALTH_CHECKS_RULE.value in enabled_biases:
                combinator.combine_if(IGNORE_HEALTH_CHECKS_BIAS, dynamic_sampling_enabled)

            if RuleType.BOOST_LATEST_RELEASES_RULE.value in enabled_biases:
                combinator.combine_if(BOOST_LATEST_RELEASES_BIAS, dynamic_sampling_enabled)

            # Add the uniform bias as the last rule so that because we use an ordered combinator we know it will be
            # combined as last.
            combinator.combine(UNIFORM_BIAS)

            return combinator
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return None


def generate_rules(project: Project) -> List[BaseRule]:
    enabled_biases = DynamicSamplingFeatureMultiplexer.get_enabled_user_biases(
        project.get_option("sentry:dynamic_sampling_biases", None)
    )

    combinator = DynamicSamplingBiases().build_combinator(
        build_type=CombinatorBuildType.FROM_ENABLED_BIASES,
        project=project,
        enabled_biases=enabled_biases,
    )

    if combinator is not None:
        rules = combinator.get_combined_rules()
        log_rules(project.organization.id, project.id, rules)
        return rules

    # In case we are not able to instantiate the combinator, we fallback to returning no rules.
    return []
