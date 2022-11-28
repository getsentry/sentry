import time
from unittest import mock
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time
from sentry_relay.processing import validate_sampling_configuration

from sentry.discover.models import TeamKeyTransaction
from sentry.dynamic_sampling.latest_release_booster import get_redis_client_for_ds
from sentry.dynamic_sampling.rules_generator import HEALTH_CHECK_GLOBS, generate_rules
from sentry.dynamic_sampling.utils import BOOSTED_KEY_TRANSACTION_LIMIT
from sentry.models import ProjectTeam
from sentry.testutils.factories import Factories
from sentry.utils import json


@pytest.fixture
def latest_release_only(default_project):
    """
    This fixture is a hacky way of automatically changing the default project options to use only the latest release
    bias.
    """
    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": "boostEnvironments", "active": False},
            {"id": "ignoreHealthChecks", "active": False},
        ],
    )


@patch("sentry.dynamic_sampling.rules_generator.sentry_sdk")
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_capture_exception(get_blended_sample_rate, sentry_sdk):
    get_blended_sample_rate.return_value = None
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    # if blended rate is None that means no dynamic sampling behavior should happen.
    # Therefore no rules should be set.
    assert generate_rules(fake_project) == []
    get_blended_sample_rate.assert_called_with(fake_project)
    sentry_sdk.capture_exception.assert_called_with()
    config_str = json.dumps({"rules": generate_rules(fake_project)})
    validate_sampling_configuration(config_str)


@patch(
    "sentry.dynamic_sampling.feature_multiplexer.DynamicSamplingFeatureMultiplexer.get_enabled_user_biases"
)
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_with_rate(
    get_blended_sample_rate, get_enabled_user_biases
):
    # it means no enabled user biases
    get_enabled_user_biases.return_value = {}
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    assert generate_rules(fake_project) == [
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        }
    ]
    get_blended_sample_rate.assert_called_with(fake_project)
    get_enabled_user_biases.assert_called_with(
        fake_project.get_option("sentry:dynamic_sampling_biases", None)
    )
    config_str = json.dumps({"rules": generate_rules(fake_project)})
    validate_sampling_configuration(config_str)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_env_rule(get_blended_sample_rate, default_project):
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    assert generate_rules(default_project) == [
        {
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
            "id": 1001,
        },
        {
            "sampleRate": 0.02,
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
            "id": 1002,
        },
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(default_project)
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_key_transaction_rule(
    get_blended_sample_rate, default_project, default_team
):
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB

    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": "boostEnvironments", "active": False},
            {"id": "ignoreHealthChecks", "active": False},
            {"id": "boostLatestRelease", "active": False},
            {"id": "boostKeyTransactions", "active": True},
        ],
    )
    default_project.add_team(default_team)

    TeamKeyTransaction.objects.create(
        organization=default_project.organization,
        transaction="/foo",
        project_team=ProjectTeam.objects.get(project=default_project, team=default_team),
    )
    assert generate_rules(default_project) == [
        {
            "active": True,
            "condition": {
                "inner": [
                    {
                        "name": "event.transaction",
                        "op": "eq",
                        "options": {"ignoreCase": True},
                        "value": ["/foo"],
                    }
                ],
                "op": "or",
            },
            "id": 1003,
            "sampleRate": 0.5,
            "type": "transaction",
        },
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(default_project)
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_key_transaction_rule_with_dups(
    get_blended_sample_rate, default_project, default_team
):
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB

    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": "boostEnvironments", "active": False},
            {"id": "ignoreHealthChecks", "active": False},
            {"id": "boostLatestRelease", "active": False},
            {"id": "boostKeyTransactions", "active": True},
        ],
    )
    team_a = Factories.create_team(organization=default_project.organization, name="Team A")
    default_project.add_team(default_team)
    default_project.add_team(team_a)

    TeamKeyTransaction.objects.create(
        organization=default_project.organization,
        transaction="/foo",
        project_team=ProjectTeam.objects.get(project=default_project, team=default_team),
    )
    # Let's assume another team for this project selects same transaction
    # so we will have dups
    TeamKeyTransaction.objects.create(
        organization=default_project.organization,
        transaction="/foo",
        project_team=ProjectTeam.objects.get(project=default_project, team=team_a),
    )
    assert generate_rules(default_project) == [
        {
            "active": True,
            "condition": {
                "inner": [
                    {
                        "name": "event.transaction",
                        "op": "eq",
                        "options": {"ignoreCase": True},
                        "value": ["/foo"],
                    }
                ],
                "op": "or",
            },
            "id": 1003,
            "sampleRate": 0.5,
            "type": "transaction",
        },
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(default_project)
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_key_transaction_rule_with_many_records(
    get_blended_sample_rate, default_project, default_team
):
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB

    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": "boostEnvironments", "active": False},
            {"id": "ignoreHealthChecks", "active": False},
            {"id": "boostLatestRelease", "active": False},
            {"id": "boostKeyTransactions", "active": True},
        ],
    )
    default_project.add_team(default_team)

    # Let's create more then transaction limit
    for tx_suffix in range(BOOSTED_KEY_TRANSACTION_LIMIT + 1):
        TeamKeyTransaction.objects.create(
            organization=default_project.organization,
            transaction=f"/foo_{tx_suffix:02d}",
            project_team=ProjectTeam.objects.get(project=default_project, team=default_team),
        )

    assert generate_rules(default_project) == [
        {
            "active": True,
            "condition": {
                "inner": [
                    {
                        "name": "event.transaction",
                        "op": "eq",
                        "options": {"ignoreCase": True},
                        "value": [f"/foo_{i:02d}" for i in range(BOOSTED_KEY_TRANSACTION_LIMIT)],
                    }
                ],
                "op": "or",
            },
            "id": 1003,
            "sampleRate": 0.5,
            "type": "transaction",
        },
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(default_project)
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)


@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_100_rate_and_without_env_rule(
    get_blended_sample_rate,
):
    get_blended_sample_rate.return_value = 1.0
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    assert generate_rules(fake_project) == [
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 1.0,
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(fake_project)
    config_str = json.dumps({"rules": generate_rules(fake_project)})
    validate_sampling_configuration(config_str)


@freeze_time("2022-10-21 18:50:25+00:00")
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
@pytest.mark.django_db
@pytest.mark.parametrize(
    ["version", "platform", "end"],
    [
        (version, platform, end)
        for version, platform, end in [
            ("1.0", "python", "2022-10-21 20:03:03+00:00"),
            ("2.0", None, "2022-10-21 19:50:25+00:00"),
        ]
    ],
)
def test_generate_rules_with_different_project_platforms(
    get_blended_sample_rate, version, platform, end, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 0.1

    redis_client = get_redis_client_for_ds()

    default_project.update(platform=platform)
    release = Factories.create_release(project=default_project, version=version)
    environment = "prod"

    redis_client.hset(
        f"ds::p:{default_project.id}:boosted_releases",
        f"ds::r:{release.id}:e:{environment}",
        time.time(),
    )

    expected = [
        {
            "sampleRate": 0.5,
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": [release.version]},
                    {
                        "op": "eq",
                        "name": "trace.environment",
                        "value": environment,
                    },
                ],
            },
            "id": 1500,
            "timeRange": {
                "start": "2022-10-21 18:50:25+00:00",
                "end": end,
            },
        },
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]
    assert generate_rules(default_project) == expected
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)


@pytest.mark.django_db
@freeze_time("2022-10-21 18:50:25+00:00")
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_latest_release_rule(
    get_blended_sample_rate, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 0.1

    redis_client = get_redis_client_for_ds()

    default_project.update(platform="python")
    first_release = Factories.create_release(project=default_project, version="1.0")
    for release, environment in (
        (first_release, "prod"),
        (first_release, "dev"),
        (first_release, None),
    ):
        env_postfix = f":e:{environment}" if environment is not None else ""
        redis_client.hset(
            f"ds::p:{default_project.id}:boosted_releases",
            f"ds::r:{release.id}{env_postfix}",
            time.time(),
        )

    expected = [
        {
            "sampleRate": 0.5,
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                    {"op": "eq", "name": "trace.environment", "value": "prod"},
                ],
            },
            "id": 1500,
            "timeRange": {"start": "2022-10-21 18:50:25+00:00", "end": "2022-10-21 20:03:03+00:00"},
        },
        {
            "sampleRate": 0.5,
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                    {"op": "eq", "name": "trace.environment", "value": "dev"},
                ],
            },
            "id": 1501,
            "timeRange": {"start": "2022-10-21 18:50:25+00:00", "end": "2022-10-21 20:03:03+00:00"},
        },
        {
            "sampleRate": 0.5,
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                    {"op": "eq", "name": "trace.environment", "value": None},
                ],
            },
            "id": 1502,
            "timeRange": {"start": "2022-10-21 18:50:25+00:00", "end": "2022-10-21 20:03:03+00:00"},
        },
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]

    assert generate_rules(default_project) == expected
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_100_rate_and_without_latest_release_rule(
    get_blended_sample_rate, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 1.0

    default_project.update(platform="python")

    assert generate_rules(default_project) == [
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 1.0,
            "type": "trace",
        },
    ]
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_non_existent_releases(
    get_blended_sample_rate, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 1.0

    redis_client = get_redis_client_for_ds()

    redis_client.hset(f"ds::p:{default_project.id}:boosted_releases", f"ds::r:{1234}", time.time())
    assert generate_rules(default_project) == [
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 1.0,
            "type": "trace",
        },
    ]
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)


@pytest.mark.django_db
@freeze_time("2022-10-21 18:50:25+00:00")
@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
@mock.patch("sentry.dynamic_sampling.rules_generator.BOOSTED_RELEASES_LIMIT", 2)
def test_generate_rules_return_uniform_rule_with_more_releases_than_the_limit(
    get_blended_sample_rate, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 0.1

    redis_client = get_redis_client_for_ds()

    releases = [
        Factories.create_release(project=default_project, version=f"{x}.0") for x in range(1, 4)
    ]

    for release in releases:
        redis_client.hset(
            f"ds::p:{default_project.id}:boosted_releases", f"ds::r:{release.id}", time.time()
        )

    expected = [
        *[
            {
                "sampleRate": 0.5,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "eq", "name": "trace.release", "value": [release.version]},
                        {"op": "eq", "name": "trace.environment", "value": None},
                    ],
                },
                "id": 1500 + index,
                "timeRange": {
                    "start": "2022-10-21 18:50:25+00:00",
                    "end": "2022-10-21 19:50:25+00:00",
                },
            }
            for index, release in enumerate(releases[-2:])
        ],
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]
    assert generate_rules(default_project) == expected
    config_str = json.dumps({"rules": generate_rules(default_project)})
    validate_sampling_configuration(config_str)
