import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Union, cast

import pytz
import sentry_sdk
from pytz import UTC

from sentry import quotas
from sentry.dynamic_sampling.feature_multiplexer import DynamicSamplingFeatureMultiplexer
from sentry.dynamic_sampling.key_transactions import get_key_transactions
from sentry.dynamic_sampling.latest_release_booster import ProjectBoostedReleases
from sentry.dynamic_sampling.utils import (
    HEALTH_CHECK_DROPPING_FACTOR,
    KEY_TRANSACTION_BOOST_FACTOR,
    RELEASE_BOOST_FACTOR,
    RESERVED_IDS,
    BaseRule,
    ReleaseRule,
    RuleType,
)
from sentry.models import Project


class DSRulesLogger:
    def __init__(self, rules: List[Tuple[RuleType, Union[BaseRule, ReleaseRule]]]):
        self.logger = logging.getLogger("dynamic_sampling.rules")
        self.rules = rules

    def log_rules(self) -> None:
        try:
            self.logger.info(
                "rules_generator.generate_rules",
                extra={
                    "rules": self._format_rules(),
                    # We set the current date as creation timestamp, however, this is not indicating that Relay
                    # did apply the rules at this time as there will be a non-deterministic delay before that happens.
                    "creation_timestamp": datetime.now(tz=pytz.utc),
                },
            )
        except Exception as e:
            # If there is any problem while generating the log message, we just silently fail and notify the error to
            # Sentry.
            sentry_sdk.capture_exception(e)

    def _format_rules(self) -> Dict:
        formatted_rules = []

        for rule_type, rule in self.rules:
            formatted_rules.append(
                {
                    "type": rule_type.value,
                    "id": rule["id"],
                    "sample_rate": rule["sampleRate"],
                    **self._extract_info_from_rule(rule_type, rule),
                }
            )

        return formatted_rules

    def _extract_info_from_rule(
        self, rule_type: RuleType, rule: Union[BaseRule, ReleaseRule]
    ) -> Dict:
        if rule_type == RuleType.BOOST_LATEST_RELEASES_RULE:
            return {
                "release": rule["condition"]["inner"][0]["value"],
                "environment": rule["condition"]["inner"][1]["value"],
            }
        elif rule_type == RuleType.BOOST_KEY_TRANSACTIONS_RULE:
            return {"transaction": rule["condition"]["inner"][0]["value"]}
        else:
            return {}


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
    boosted_releases = ProjectBoostedReleases(project_id).get_extended_boosted_releases()
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
    rules: List[Tuple(RuleType, Union[BaseRule, ReleaseRule])] = []

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
                    rules.append(
                        (
                            RuleType.BOOST_KEY_TRANSACTIONS_RULE,
                            generate_boost_key_transaction_rule(sample_rate, key_transactions),
                        )
                    )

            # Environments boost
            if RuleType.BOOST_ENVIRONMENTS_RULE.value in enabled_biases:
                rules.append((RuleType.BOOST_ENVIRONMENTS_RULE, generate_environment_rule()))

            # Add Ignore health check rule
            if RuleType.IGNORE_HEALTHCHECKS_RULE.value in enabled_biases:
                rules.append(
                    (RuleType.IGNORE_HEALTHCHECKS_RULE, generate_healthcheck_rule(sample_rate))
                )

            # Latest releases
            if RuleType.BOOST_LATEST_RELEASES_RULE.value in enabled_biases:
                boost_release_rules = generate_boost_release_rules(project.id, sample_rate)

                rules += list(
                    zip(
                        [RuleType.BOOST_LATEST_RELEASES_RULE] * len(boost_release_rules),
                        boost_release_rules,
                    )
                )

        rules.append((RuleType.UNIFORM_RULE, generate_uniform_rule(sample_rate)))

    # We log rules onto Google Cloud Logging in order to have more observability into dynamic sampling rules.
    DSRulesLogger(rules).log_rules()

    # We only return the rule and not its type.
    return list(map(lambda rule: rule[1], rules))
