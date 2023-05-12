from sentry.dynamic_sampling.rules.biases.boost_environments_bias import BoostEnvironmentsBias
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import BoostLatestReleasesBias
from sentry.dynamic_sampling.rules.biases.boost_rare_transactions_rule import (
    RareTransactionsRulesBias,
)
from sentry.dynamic_sampling.rules.biases.boost_replay_id_bias import BoostReplayIdBias
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import IgnoreHealthChecksBias
from sentry.dynamic_sampling.rules.biases.recalibration_bias import RecalibrationBias
from sentry.dynamic_sampling.rules.biases.uniform_bias import UniformBias
from sentry.dynamic_sampling.rules.combinators.base import BiasesCombinator
from sentry.dynamic_sampling.rules.combinators.ordered_combinator import OrderedBiasesCombinator
from sentry.dynamic_sampling.rules.utils import RuleType
from sentry.models import Organization


def get_relay_biases_combinator(_: Organization) -> BiasesCombinator:
    default_combinator = OrderedBiasesCombinator()

    default_combinator.add(RuleType.IGNORE_HEALTH_CHECKS_RULE, IgnoreHealthChecksBias())

    # TODO: rethink how to add this rule in case we agree on keeping the sliding window org.
    default_combinator.add_if(
        RuleType.RECALIBRATION_RULE,
        RecalibrationBias(),
        lambda: False,
    )
    default_combinator.add(RuleType.BOOST_REPLAY_ID_RULE, BoostReplayIdBias())
    default_combinator.add(RuleType.BOOST_ENVIRONMENTS_RULE, BoostEnvironmentsBias())
    default_combinator.add(RuleType.BOOST_LATEST_RELEASES_RULE, BoostLatestReleasesBias())
    default_combinator.add(RuleType.BOOST_LOW_VOLUME_TRANSACTIONS, RareTransactionsRulesBias())
    default_combinator.add(RuleType.UNIFORM_RULE, UniformBias())

    return default_combinator
