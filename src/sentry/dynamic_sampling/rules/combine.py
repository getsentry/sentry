from sentry.dynamic_sampling.rules.biases.boost_environments_bias import BoostEnvironmentsBias
from sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias import (
    BoostKeyTransactionsBias,
)
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import BoostLatestReleasesBias
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import IgnoreHealthChecksBias
from sentry.dynamic_sampling.rules.biases.uniform_bias import UniformBias
from sentry.dynamic_sampling.rules.combinators.base import BiasesCombinator
from sentry.dynamic_sampling.rules.combinators.ordered_combinator import OrderedBiasesCombinator
from sentry.dynamic_sampling.rules.utils import RuleType


def _get_default_combinator() -> BiasesCombinator:
    # The default combinator is the ordered combinator, which will keep the insertion order of the rules.
    return OrderedBiasesCombinator()


def get_relay_biases_combinator() -> BiasesCombinator:
    default_combinator = _get_default_combinator()

    # The combination depends on the default_combinator used but in case of the ordered combinator the first combined
    # rule will be the first rule in the output (e.g., UNIFORM_RULE will be the last).
    #
    # The ordering is very important, especially because relay performs matching following a FIFO matching algorithm.
    #
    # If you need to add any new bias, add it here after having created all the necessary classes.
    default_combinator.combine(RuleType.BOOST_KEY_TRANSACTIONS_RULE, BoostKeyTransactionsBias())
    default_combinator.combine(RuleType.BOOST_ENVIRONMENTS_RULE, BoostEnvironmentsBias())
    default_combinator.combine(RuleType.IGNORE_HEALTH_CHECKS_RULE, IgnoreHealthChecksBias())
    default_combinator.combine(RuleType.BOOST_LATEST_RELEASES_RULE, BoostLatestReleasesBias())
    default_combinator.combine(RuleType.UNIFORM_RULE, UniformBias())

    return default_combinator
