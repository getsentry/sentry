from sentry import features
from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.biases.bias_combinator import OrderedBiasesCombinator
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
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import (
    IgnoreHealthChecksTraceBias,
    IgnoreHealthChecksTransactionBias,
)
from sentry.dynamic_sampling.rules.biases.minimum_sample_rate_bias import MinimumSampleRateBias
from sentry.dynamic_sampling.rules.biases.recalibration_bias import RecalibrationBias
from sentry.dynamic_sampling.rules.utils import RuleType
from sentry.models.organization import Organization


def get_relay_biases(organization: Organization) -> dict[RuleType, Bias]:
    is_health_checks_trace_based = features.has(
        "organizations:ds-health-checks-trace-based", organization, actor=None
    )
    default_combinator = OrderedBiasesCombinator()

    default_combinator.add(RuleType.CUSTOM_RULE, CustomRuleBias())
    default_combinator.add_if(
        RuleType.IGNORE_HEALTH_CHECKS_RULE,
        IgnoreHealthChecksTraceBias(),
        lambda: is_health_checks_trace_based,
    )
    default_combinator.add_if(
        RuleType.IGNORE_HEALTH_CHECKS_RULE,
        IgnoreHealthChecksTransactionBias(),
        lambda: not is_health_checks_trace_based,
    )

    default_combinator.add(RuleType.BOOST_REPLAY_ID_RULE, BoostReplayIdBias())
    default_combinator.add(RuleType.BOOST_ENVIRONMENTS_RULE, BoostEnvironmentsBias())
    default_combinator.add(RuleType.RECALIBRATION_RULE, RecalibrationBias())
    default_combinator.add(RuleType.BOOST_LATEST_RELEASES_RULE, BoostLatestReleasesBias())
    default_combinator.add(
        RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE, BoostLowVolumeTransactionsBias()
    )
    default_combinator.add_if(
        RuleType.MINIMUM_SAMPLE_RATE_RULE,
        MinimumSampleRateBias(),
        lambda: features.has(
            "organizations:dynamic-sampling-minimum-sample-rate", organization, actor=None
        ),
    )
    default_combinator.add(RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE, BoostLowVolumeProjectsBias())

    return default_combinator.biases
