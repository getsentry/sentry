from sentry import features
from sentry.dynamic_sampling.rules.biases.boost_environments_bias import BoostEnvironmentsBias
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import BoostLatestReleasesBias
from sentry.dynamic_sampling.rules.biases.boost_low_volume_projects_bias import (
    BoostLowVolumeProjectsBias,
)
from sentry.dynamic_sampling.rules.biases.boost_low_volume_transactions_bias import (
    BoostLowVolumeTransactionsBias,
)
from sentry.dynamic_sampling.rules.biases.boost_replay_id_bias import BoostReplayIdBias
from sentry.dynamic_sampling.rules.biases.custom_rule_bias import CustomRuleBias
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import IgnoreHealthChecksBias
from sentry.dynamic_sampling.rules.biases.recalibration_bias import RecalibrationBias
from sentry.dynamic_sampling.rules.combinators.base import BiasesCombinator
from sentry.dynamic_sampling.rules.combinators.ordered_combinator import OrderedBiasesCombinator
from sentry.dynamic_sampling.rules.utils import RuleType
from sentry.models.organization import Organization


def get_relay_biases_combinator(organization: Organization) -> BiasesCombinator:
    default_combinator = OrderedBiasesCombinator()

    default_combinator.add(RuleType.CUSTOM_RULE, CustomRuleBias())
    default_combinator.add(RuleType.IGNORE_HEALTH_CHECKS_RULE, IgnoreHealthChecksBias())

    default_combinator.add(RuleType.BOOST_REPLAY_ID_RULE, BoostReplayIdBias())
    default_combinator.add(RuleType.BOOST_ENVIRONMENTS_RULE, BoostEnvironmentsBias())
    default_combinator.add_if(
        RuleType.RECALIBRATION_RULE,
        RecalibrationBias(),
        lambda: features.has("organizations:ds-org-recalibration", organization, actor=None),
    )
    default_combinator.add(RuleType.BOOST_LATEST_RELEASES_RULE, BoostLatestReleasesBias())
    default_combinator.add(
        RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE, BoostLowVolumeTransactionsBias()
    )
    default_combinator.add(RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE, BoostLowVolumeProjectsBias())

    return default_combinator
