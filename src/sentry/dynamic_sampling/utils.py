from typing import Dict, List, Optional, TypedDict
from pytz import UTC
from datetime import datetime
import sentry_sdk

from sentry import quotas
from sentry.dynamic_sampling.latest_release_booster import BOOSTED_RELEASE_TIMEOUT, get_boosted_releases
from sentry.models import Project, Release

UNIFORM_RULE_RESERVED_ID = 0
BOOSTED_RELEASE_ASSIGNED_ID = 500
BOOSTED_RELEASES_LIMIT = 10
RELEASE_BOOST_FACTOR = 1.5


class Bias(TypedDict):
    id: str
    active: bool


# These represent the biases that are applied to user by default as part of the adaptive dynamic sampling experience.
# These can be overridden by the project details endpoint
DEFAULT_BIASES: List[Bias] = [
    {"id": "boostEnvironments", "active": True},
    {
        "id": "boostLatestRelease",
        "active": True,
    },
    {"id": "ignoreHealthChecks", "active": True},
]


class Inner(TypedDict):
    op: str
    name: str
    value: List[str]
    options: Dict[str, bool]


class Condition(TypedDict):
    op: str
    inner: List[Optional[Inner]]


class BaseRule(TypedDict):
    sampleRate: Optional[float]
    type: str
    active: bool
    condition: Condition
    id: int


def generate_uniform_rule(sample_rate: Optional[float]) -> BaseRule:
    return {
        "sampleRate": sample_rate,
        "type": "trace",
        "active": True,
        "condition": {
            "op": "and",
            "inner": [],
        },
        "id": UNIFORM_RULE_RESERVED_ID,
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
        "id": 1,
    }


def generate_boost_release_rules(project_id, sample_rate):
    boosted_release_in_cache = get_boosted_releases(project_id)
    if not boosted_release_in_cache:
        return []

    # Capped to latest 5 releases
    boosted_releases_objs = Release.objects.filter(
        id__in=[r[0] for r in boosted_release_in_cache[-BOOSTED_RELEASES_LIMIT:]]
    )
    boosted_releases_dict = {release.id: release.version for release in boosted_releases_objs}

    boosted_release_versions = []
    for (release_id, timestamp) in boosted_release_in_cache:
        if release_id not in boosted_releases_dict:
            continue
        boosted_release_versions.append((boosted_releases_dict[release_id], timestamp))

    boosted_sample_rate = min(1.0, sample_rate * RELEASE_BOOST_FACTOR)
    return [
        {
            "sampleRate": boosted_sample_rate,
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [
                    {
                        "op": "glob",
                        "name": "trace.release",
                        "value": [release_version],
                    }
                ],
            },
            "id": BOOSTED_RELEASE_ASSIGNED_ID + idx,
            "timeRange": {
                "start": str(datetime.utcfromtimestamp(timestamp).replace(tzinfo=UTC)),
                "end": str(
                    datetime.utcfromtimestamp(timestamp + BOOSTED_RELEASE_TIMEOUT).replace(
                        tzinfo=UTC
                    )
                ),
            },
        }
        for idx, (release_version, timestamp) in enumerate(boosted_release_versions)
    ]


def generate_rules(project: Project, boost_releases=False):
    """
    This function handles generate rules logic or fallback empty list of rules
    """
    rules = []
    sample_rate = quotas.get_blended_sample_rate(project)
    if sample_rate is None:
        try:
            raise Exception("get_blended_sample_rate returns none")
        except Exception:
            sentry_sdk.capture_exception()
    else:
        if boost_releases and sample_rate < 1.0:
            rules += generate_boost_release_rules(project.id, sample_rate)
        rules.append(generate_uniform_rule(sample_rate))

    return rules
