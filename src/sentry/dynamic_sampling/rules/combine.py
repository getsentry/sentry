from sentry.dynamic_sampling.rules.biases.boost_environments_bias import BoostEnvironmentsBias
from sentry.dynamic_sampling.rules.biases.boost_key_transactions_bias import (
    BoostKeyTransactionsBias,
)
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import BoostLatestReleasesBias
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import IgnoreHealthChecksBias
from sentry.dynamic_sampling.rules.biases.uniform_bias import UniformBias
from sentry.dynamic_sampling.rules.combinators.ordered_combinator import OrderedBiasesCombinator
from sentry.dynamic_sampling.utils import RuleType

# We use the ordered combinator here, which will preserve the insertion order, which means that the first rule will
# be first in the output.
#
# In case the ordering needs to be changed a new implementation of the BiasesCombinator should be done and swapped here.
DEFAULT_COMBINATOR = OrderedBiasesCombinator()
DEFAULT_COMBINATOR.combine(RuleType.BOOST_KEY_TRANSACTIONS_RULE, BoostKeyTransactionsBias())
DEFAULT_COMBINATOR.combine(RuleType.BOOST_ENVIRONMENTS_RULE, BoostEnvironmentsBias())
DEFAULT_COMBINATOR.combine(RuleType.IGNORE_HEALTH_CHECKS_RULE, IgnoreHealthChecksBias())
DEFAULT_COMBINATOR.combine(RuleType.BOOST_LATEST_RELEASES_RULE, BoostLatestReleasesBias())
DEFAULT_COMBINATOR.combine(RuleType.UNIFORM_RULE, UniformBias())
