from datetime import datetime
from typing import List, Optional, Union, cast

import sentry_sdk
from pytz import UTC

from sentry import quotas
from sentry.dynamic_sampling.feature_multiplexer import DynamicSamplingFeatureMultiplexer
from sentry.dynamic_sampling.key_transactions import get_key_transactions
from sentry.dynamic_sampling.latest_release_booster import get_augmented_boosted_releases
from sentry.dynamic_sampling.utils import (
    BOOSTED_RELEASES_LIMIT,
    HEALTH_CHECK_DROPPING_FACTOR,
    KEY_TRANSACTION_BOOST_FACTOR,
    RELEASE_BOOST_FACTOR,
    RESERVED_IDS,
    BaseRule,
    ReleaseRule,
    RuleType,
)
from sentry.models import Project

# https://kubernetes.io/docs/reference/using-api/health-checks/
# Also it covers: livez, readyz
HEALTH_CHECK_GLOBS = [
    "*healthcheck*",
    "*healthy*",
    "*live*",
    "*ready*",
    "*heartbeat*",
    "*/health",
    "*/healthz",
]

ALL_ENVIRONMENTS = "*"


def generate_uniform_rule(sample_rate: Optional[float]) -> BaseRule:
    return {
        "sampleRate": sample_rate,
        "type": "trace",
        "active": True,
        "condition": {
            "op": "and",
            "inner": [],
        },
        "id": RESERVED_IDS[RuleType.UNIFORM_RULE],
    }


def generate_environment_rule() -> BaseRule:
    return {
        "sampleRate": 1,
        "type": "trace",
        "condition": {
            "op": "or",
            "inner": [
                {
                    "op": "glob",
                    "name": "trace.environment",
                    "value": ["*dev*", "*test*"],
                    "options": {"ignoreCase": True},
                }
            ],
        },
        "active": True,
        "id": RESERVED_IDS[RuleType.BOOST_ENVIRONMENTS_RULE],
    }


def generate_healthcheck_rule(sample_rate: float) -> BaseRule:
    return {
        "sampleRate": sample_rate / HEALTH_CHECK_DROPPING_FACTOR,
        "type": "transaction",
        "condition": {
            "op": "or",
            "inner": [
                {
                    "op": "glob",
                    "name": "event.transaction",
                    "value": HEALTH_CHECK_GLOBS,
                    "options": {"ignoreCase": True},
                }
            ],
        },
        "active": True,
        "id": RESERVED_IDS[RuleType.IGNORE_HEALTHCHECKS_RULE],
    }


def generate_boost_release_rules(project_id: int, sample_rate: float) -> List[ReleaseRule]:
    boosted_releases = get_augmented_boosted_releases(project_id, BOOSTED_RELEASES_LIMIT)
    boosted_sample_rate = min(1.0, sample_rate * RELEASE_BOOST_FACTOR)

    return cast(
        List[ReleaseRule],
        [
            {
                "sampleRate": boosted_sample_rate,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [
                        {
                            "op": "eq",
                            "name": "trace.release",
                            "value": [boosted_release.version],
                        },
                        {
                            "op": "eq",
                            "name": "trace.environment",
                            # When environment is None, it will be mapped to equivalent null in json.
                            # When Relay receives a rule with "value": null it will match it against events without
                            # the environment tag set.
                            "value": boosted_release.environment,
                        },
                    ],
                },
                "id": RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE] + idx,
                "timeRange": {
                    "start": str(
                        datetime.utcfromtimestamp(boosted_release.timestamp).replace(tzinfo=UTC)
                    ),
                    "end": str(
                        datetime.utcfromtimestamp(
                            boosted_release.timestamp + boosted_release.platform.time_to_adoption
                        ).replace(tzinfo=UTC)
                    ),
                },
            }
            for idx, boosted_release in enumerate(boosted_releases)
        ],
    )


def generate_boost_key_transaction_rule(
    sample_rate: float, key_transactions: List[str]
) -> BaseRule:
    return {
        "sampleRate": min(1.0, sample_rate * KEY_TRANSACTION_BOOST_FACTOR),
        "type": "transaction",
        "condition": {
            "op": "or",
            "inner": [
                {
                    "op": "eq",
                    "name": "event.transaction",
                    "value": key_transactions,
                    "options": {"ignoreCase": True},
                }
            ],
        },
        "active": True,
        "id": RESERVED_IDS[RuleType.BOOST_KEY_TRANSACTIONS_RULE],
    }


def generate_rules(project: Project) -> List[Union[BaseRule, ReleaseRule]]:
    """
    This function handles generate rules logic or fallback empty list of rules
    """
    rules: List[Union[BaseRule, ReleaseRule]] = []

    sample_rate = quotas.get_blended_sample_rate(project)

    if sample_rate is None:
        try:
            raise Exception("get_blended_sample_rate returns none")
        except Exception:
            sentry_sdk.capture_exception()
    else:
        if sample_rate < 1.0:

            enabled_biases = DynamicSamplingFeatureMultiplexer.get_enabled_user_biases(
                project.get_option("sentry:dynamic_sampling_biases", None)
            )
            # Key Transaction boost
            if RuleType.BOOST_KEY_TRANSACTIONS_RULE.value in enabled_biases:
                key_transactions = get_key_transactions(project)
                if key_transactions:
                    rules.append(generate_boost_key_transaction_rule(sample_rate, key_transactions))

            # Environments boost
            if RuleType.BOOST_ENVIRONMENTS_RULE.value in enabled_biases:
                rules.append(generate_environment_rule())

            # Add Ignore health check rule
            if RuleType.IGNORE_HEALTHCHECKS_RULE.value in enabled_biases:
                rules.append(generate_healthcheck_rule(sample_rate))

            # Latest releases
            if RuleType.BOOST_LATEST_RELEASES_RULE.value in enabled_biases:
                rules += generate_boost_release_rules(project.id, sample_rate)

        rules.append(generate_uniform_rule(sample_rate))

    return rules
