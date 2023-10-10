from datetime import timedelta
from typing import List
from unittest.mock import patch

from django.utils import timezone

from sentry.dynamic_sampling import LATEST_RELEASE_TTAS, ExtendedBoostedRelease, Platform
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import BoostLatestReleasesBias
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all

ONE_DAY_AGO = timezone.now() - timedelta(days=1)
MOCK_DATETIME = ONE_DAY_AGO.replace(hour=10, minute=0, second=0, microsecond=0)


@freeze_time(MOCK_DATETIME)
@django_db_all
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.ProjectBoostedReleases.get_extended_boosted_releases"
)
def test_generate_bias_rules_v2(get_boosted_releases, default_project):
    now = timezone.now()
    platform = "python"
    default_project.update(platform=platform)
    boosted_releases = [
        ExtendedBoostedRelease(
            id=12345,
            timestamp=now.timestamp(),
            environment=None,
            cache_key="abc",
            version="1.0",
            platform=Platform(platform),
        ),
        ExtendedBoostedRelease(
            id=678910,
            timestamp=now.timestamp(),
            environment="prod",
            cache_key="def",
            version="2.0",
            platform=Platform(platform),
        ),
    ]
    get_boosted_releases.return_value = boosted_releases

    rules = BoostLatestReleasesBias().generate_rules(project=default_project, base_sample_rate=0.0)
    assert rules == [
        {
            "condition": {
                "inner": [
                    {"name": "trace.release", "op": "eq", "value": ["1.0"]},
                    {"name": "trace.environment", "op": "eq", "value": None},
                ],
                "op": "and",
            },
            "id": 1500,
            "samplingValue": {"type": "factor", "value": 1.5},
            "timeRange": {
                "end": (now + timedelta(seconds=LATEST_RELEASE_TTAS[platform]))
                .isoformat()
                .replace("+00:00", "Z"),
                "start": now.isoformat().replace("+00:00", "Z"),
            },
            "decayingFn": {"type": "linear", "decayedValue": 1.0},
            "type": "trace",
        },
        {
            "condition": {
                "inner": [
                    {"name": "trace.release", "op": "eq", "value": ["2.0"]},
                    {"name": "trace.environment", "op": "eq", "value": "prod"},
                ],
                "op": "and",
            },
            "id": 1501,
            "samplingValue": {"type": "factor", "value": 1.5},
            "timeRange": {
                "end": (now + timedelta(seconds=LATEST_RELEASE_TTAS[platform]))
                .isoformat()
                .replace("+00:00", "Z"),
                "start": now.isoformat().replace("+00:00", "Z"),
            },
            "decayingFn": {"type": "linear", "decayedValue": 1.0},
            "type": "trace",
        },
    ]


@django_db_all
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.ProjectBoostedReleases.get_extended_boosted_releases"
)
def test_generate_bias_rules_with_no_boosted_releases(get_boosted_releases, default_project):
    default_project.update(platform="python")
    boosted_releases: List[ExtendedBoostedRelease] = []
    get_boosted_releases.return_value = boosted_releases

    rules = BoostLatestReleasesBias().generate_rules(project=default_project, base_sample_rate=0.0)
    assert rules == []
