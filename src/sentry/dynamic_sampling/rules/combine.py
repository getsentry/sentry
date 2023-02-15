from sentry.dynamic_sampling.rules.biases.boost_environments_bias import (
    BoostEnvironmentsBias,
    BoostEnvironmentsBiasV2,
)
from sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias import (
    BoostKeyTransactionsBias,
    BoostKeyTransactionsBiasV2,
)
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import (
    BoostLatestReleasesBias,
    BoostLatestReleasesBiasV2,
)
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import (
    IgnoreHealthChecksBias,
    IgnoreHealthChecksBiasV2,
)
from sentry.dynamic_sampling.rules.biases.uniform_bias import UniformBias, UniformBiasV2
from sentry.dynamic_sampling.rules.combinators.base import BiasesCombinator
from sentry.dynamic_sampling.rules.combinators.ordered_combinator import OrderedBiasesCombinator
from sentry.dynamic_sampling.rules.utils import RuleType


def get_relay_biases_combinator() -> BiasesCombinator:
    # The default combinator is the ordered combinator, which will keep the insertion order of the rules.
    default_combinator = OrderedBiasesCombinator()

    # The combination depends on the default_combinator used but in case of the ordered combinator the first combined
    # rule will be the first rule in the output (e.g., UNIFORM_RULE will be the last).
    #
    # The ordering is very important, especially because relay performs matching following a FIFO matching algorithm.
    #
    # If you need to add any new bias, add it here after having created all the necessary classes.
    default_combinator.add(RuleType.BOOST_KEY_TRANSACTIONS_RULE, BoostKeyTransactionsBias())
    default_combinator.add(RuleType.IGNORE_HEALTH_CHECKS_RULE, IgnoreHealthChecksBias())

    default_combinator.add(RuleType.BOOST_ENVIRONMENTS_RULE, BoostEnvironmentsBias())
    default_combinator.add(RuleType.BOOST_LATEST_RELEASES_RULE, BoostLatestReleasesBias())
    default_combinator.add(RuleType.UNIFORM_RULE, UniformBias())

    return default_combinator


def get_relay_biases_combinator_v2() -> BiasesCombinator:
    default_combinator = OrderedBiasesCombinator()

    default_combinator.add(RuleType.BOOST_KEY_TRANSACTIONS_RULE, BoostKeyTransactionsBiasV2())
    default_combinator.add(RuleType.IGNORE_HEALTH_CHECKS_RULE, IgnoreHealthChecksBiasV2())

    default_combinator.add(RuleType.BOOST_ENVIRONMENTS_RULE, BoostEnvironmentsBiasV2())
    default_combinator.add(RuleType.BOOST_LATEST_RELEASES_RULE, BoostLatestReleasesBiasV2())
    default_combinator.add(RuleType.UNIFORM_RULE, UniformBiasV2())

    return default_combinator
