from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling import LATEST_RELEASE_TTAS, ExtendedBoostedRelease, Platform
from sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias import (
    BoostLatestReleasesRulesGenerator,
)

ONE_DAY_AGO = timezone.now() - timedelta(days=1)
MOCK_DATETIME = ONE_DAY_AGO.replace(hour=10, minute=0, second=0, microsecond=0)


@freeze_time(MOCK_DATETIME)
@pytest.mark.django_db
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.BoostLatestReleasesDataProvider"
)
def test_generate_bias_rules_v2(data_provider, default_project):
    now = timezone.now()

    factor = 1.5
    decayed_factor = 1.0
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

    data_provider.get_bias_data.return_value = {
        "id": 1000,
        "factor": factor,
        "decayedFactor": decayed_factor,
        "boostedReleases": boosted_releases,
    }

    rules = BoostLatestReleasesRulesGenerator(data_provider).generate_bias_rules(MagicMock())
    assert rules == [
        {
            "condition": {
                "inner": [
                    {"name": "trace.release", "op": "eq", "value": ["1.0"]},
                    {"name": "trace.environment", "op": "eq", "value": None},
                ],
                "op": "and",
            },
            "id": 1000,
            "samplingValue": {"type": "factor", "value": factor},
            "timeRange": {
                "end": (now + timedelta(seconds=LATEST_RELEASE_TTAS[platform]))
                .isoformat()
                .replace("+00:00", "Z"),
                "start": now.isoformat().replace("+00:00", "Z"),
            },
            "decayingFn": {"type": "linear", "decayedValue": decayed_factor},
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
            "id": 1001,
            "samplingValue": {"type": "factor", "value": factor},
            "timeRange": {
                "end": (now + timedelta(seconds=LATEST_RELEASE_TTAS[platform]))
                .isoformat()
                .replace("+00:00", "Z"),
                "start": now.isoformat().replace("+00:00", "Z"),
            },
            "decayingFn": {"type": "linear", "decayedValue": decayed_factor},
            "type": "trace",
        },
    ]


@pytest.mark.django_db
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.BoostLatestReleasesDataProvider"
)
def test_generate_bias_rules_with_no_boosted_releases(data_provider, default_project):
    default_project.update(platform="python")

    data_provider.get_bias_data.return_value = {
        "id": 1000,
        "sampleRate": 0.7,
        "boostedReleases": [],
    }

    rules = BoostLatestReleasesRulesGenerator(data_provider).generate_bias_rules(MagicMock())
    assert rules == []
