from datetime import datetime
from typing import List, Optional, Union, cast

import sentry_sdk
from pytz import UTC

from sentry import quotas
from sentry.dynamic_sampling.feature_multiplexer import DynamicSamplingFeatureMultiplexer
from sentry.dynamic_sampling.latest_release_booster import (
    BOOSTED_RELEASE_TIMEOUT,
    get_boosted_releases,
)
from sentry.dynamic_sampling.utils import (
    BOOSTED_RELEASES_LIMIT,
    HEALTH_CHECK_DROPPING_FACTOR,
    RELEASE_BOOST_FACTOR,
    RESERVED_IDS,
    BaseRule,
    Condition,
    Inner,
    ReleaseRule,
    RuleType,
)
from sentry.models import Project, Release

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


def _generate_environment_condition(environment: Optional[str]) -> Union[Condition, Inner]:
    environment_condition = {
        "op": "glob",
        "name": "trace.environment",
        "value": [environment if environment is not None else ALL_ENVIRONMENTS],
    }

    # In case we want to generate a rule for a trace without an environment we can use negations to express it as
    # a trace that has an environment that doesn't match any environment.
    if environment is None:
        environment_condition = {"op": "not", "inner": environment_condition}  # type: ignore

    return environment_condition  # type: ignore


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
    boosted_release_in_cache = get_boosted_releases(project_id)
    if not boosted_release_in_cache:
        return []

    # Capped to latest 5 releases
    boosted_releases_objs = Release.objects.filter(
        id__in=[r[0] for r in boosted_release_in_cache[-BOOSTED_RELEASES_LIMIT:]]
    )
    boosted_releases_dict = {release.id: release.version for release in boosted_releases_objs}

    boosted_release_versions = []
    for (release_id, environment, timestamp) in boosted_release_in_cache:
        if release_id not in boosted_releases_dict:
            continue
        boosted_release_versions.append((boosted_releases_dict[release_id], environment, timestamp))

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
                            "op": "glob",
                            "name": "trace.release",
                            "value": [release_version],
                        },
                        _generate_environment_condition(environment),
                    ],
                },
                "id": RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE] + idx,
                "timeRange": {
                    "start": str(datetime.utcfromtimestamp(timestamp).replace(tzinfo=UTC)),
                    "end": str(
                        datetime.utcfromtimestamp(timestamp + BOOSTED_RELEASE_TIMEOUT).replace(
                            tzinfo=UTC
                        )
                    ),
                },
            }
            for idx, (release_version, environment, timestamp) in enumerate(
                boosted_release_versions
            )
        ],
    )


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
