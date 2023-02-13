from sentry.dynamic_sampling.rules.biases.boost_environments_bias import BoostEnvironmentsBiasV2
from sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias import (
    BoostKeyTransactionsBiasV2,
)
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import (
    BoostLatestReleasesBiasV2,
)
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import IgnoreHealthChecksBiasV2
from sentry.dynamic_sampling.rules.biases.uniform_bias import UniformBiasV2
from sentry.dynamic_sampling.rules.combinators.base import BiasesCombinator
from sentry.dynamic_sampling.rules.combinators.ordered_combinator import OrderedBiasesCombinator
from sentry.dynamic_sampling.rules.utils import RuleType


def get_relay_biases_combinator_v2() -> BiasesCombinator:
    default_combinator = OrderedBiasesCombinator()

    default_combinator.add(RuleType.IGNORE_HEALTH_CHECKS_RULE, IgnoreHealthChecksBiasV2())
    default_combinator.add(RuleType.BOOST_KEY_TRANSACTIONS_RULE, BoostKeyTransactionsBiasV2())

    default_combinator.add(RuleType.BOOST_ENVIRONMENTS_RULE, BoostEnvironmentsBiasV2())
    default_combinator.add(RuleType.BOOST_LATEST_RELEASES_RULE, BoostLatestReleasesBiasV2())
    default_combinator.add(RuleType.UNIFORM_RULE, UniformBiasV2())

    return default_combinator
