from sentry.dynamic_sampling.bias_rules.biases.boost_environments_bias import (
    BoostEnvironmentsDataProvider,
    BoostEnvironmentsRulesGenerator,
)
from sentry.dynamic_sampling.bias_rules.biases.latest_release_bias import (
    LatestReleaseDataProvider,
    LatestReleaseRulesGenerator,
)
from sentry.dynamic_sampling.bias_rules.combinators.relay_combinator import RelayBiasRulesCombinator
from sentry.dynamic_sampling.bias_rules.common import Bias
from sentry.dynamic_sampling.feature_multiplexer import DynamicSamplingFeatureMultiplexer
from sentry.dynamic_sampling.utils import RuleType
from sentry.models import Project


class DynamicSamplingBiases:
    def __init__(self):
        self.combinator = RelayBiasRulesCombinator()

    @classmethod
    def with_active_biases(cls, project: Project) -> "DynamicSamplingBiases":
        self = DynamicSamplingBiases()

        enabled_biases = DynamicSamplingFeatureMultiplexer.get_enabled_user_biases(
            project.get_option("sentry:dynamic_sampling_biases", None)
        )

        if RuleType.BOOST_ENVIRONMENTS_RULE.value in enabled_biases:
            self.combinator.combine(
                Bias(BoostEnvironmentsDataProvider, BoostEnvironmentsRulesGenerator)
            )

        if RuleType.IGNORE_HEALTHCHECKS_RULE.value in enabled_biases:
            self.combinator.combine(Bias(LatestReleaseDataProvider, LatestReleaseRulesGenerator))

        # Here we can add other rules easily.

        return self

    def get_all_rules(self):
        self.combinator.get_combined_rules()
