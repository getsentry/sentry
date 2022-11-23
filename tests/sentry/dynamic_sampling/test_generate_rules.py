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
from sentry.models import ProjectTeam, Release
from sentry.testutils import TestCase
from sentry.testutils.factories import Factories
from sentry.utils import json


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


class LatestReleaseTest(TestCase):
    def setUp(self):
        self.project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": False},
                {"id": "ignoreHealthChecks", "active": False},
            ],
        )
        self.redis_client = get_redis_client_for_ds()

    @freeze_time("2022-10-21 18:50:25.000000+00:00")
    @patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
    def test_generate_rules_return_uniform_rules_and_latest_release_rule(
        self, get_blended_sample_rate
    ):
        get_blended_sample_rate.return_value = 0.1
        # since we mock get_blended_sample_rate function
        # no need to create real project in DB
        ts = time.time()

        for release, environment in (
            (Release.get_or_create(project=self.project, version="1.0"), "prod"),
            (Release.get_or_create(project=self.project, version="1.0"), "dev"),
            (Release.get_or_create(project=self.project, version="1.0"), None),
        ):
            env_postfix = f":e:{environment}" if environment is not None else ""
            self.redis_client.hset(
                f"ds::p:{self.project.id}:boosted_releases",
                f"ds::r:{release.id}{env_postfix}",
                ts,
            )

        expected = [
            {
                "sampleRate": 0.5,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "glob", "name": "trace.release", "value": ["1.0"]},
                        {"op": "glob", "name": "trace.environment", "value": ["prod"]},
                    ],
                },
                "id": 1500,
                "timeRange": {
                    "start": "2022-10-21 18:50:25+00:00",
                    "end": "2022-10-21 19:50:25+00:00",
                },
            },
            {
                "sampleRate": 0.5,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "glob", "name": "trace.release", "value": ["1.0"]},
                        {"op": "glob", "name": "trace.environment", "value": ["dev"]},
                    ],
                },
                "id": 1501,
                "timeRange": {
                    "start": "2022-10-21 18:50:25+00:00",
                    "end": "2022-10-21 19:50:25+00:00",
                },
            },
            {
                "sampleRate": 0.5,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "glob", "name": "trace.release", "value": ["1.0"]},
                        {
                            "op": "not",
                            "inner": {
                                "op": "glob",
                                "name": "trace.environment",
                                "value": ["*"],
                            },
                        },
                    ],
                },
                "id": 1502,
                "timeRange": {
                    "start": "2022-10-21 18:50:25+00:00",
                    "end": "2022-10-21 19:50:25+00:00",
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

        assert generate_rules(self.project) == expected
        config_str = json.dumps({"rules": expected})
        validate_sampling_configuration(config_str)

    @patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
    def test_generate_rules_return_uniform_rule_with_100_rate_and_without_latest_release_rule(
        self,
        get_blended_sample_rate,
    ):
        get_blended_sample_rate.return_value = 1.0
        assert generate_rules(self.project) == [
            {
                "active": True,
                "condition": {"inner": [], "op": "and"},
                "id": 1000,
                "sampleRate": 1.0,
                "type": "trace",
            },
        ]

    @patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
    def test_generate_rules_return_uniform_rule_with_non_existent_releases(
        self,
        get_blended_sample_rate,
    ):
        get_blended_sample_rate.return_value = 1.0
        self.redis_client.hset(
            f"ds::p:{self.project.id}:boosted_releases", f"ds::r:{1234}", time.time()
        )
        assert generate_rules(self.project) == [
            {
                "active": True,
                "condition": {"inner": [], "op": "and"},
                "id": 1000,
                "sampleRate": 1.0,
                "type": "trace",
            },
        ]

    @freeze_time("2022-10-21 18:50:25.000000+00:00")
    @patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
    @mock.patch("sentry.dynamic_sampling.rules_generator.BOOSTED_RELEASES_LIMIT", 2)
    def test_generate_rules_return_uniform_rule_with_more_releases_than_the_limit(
        self,
        get_blended_sample_rate,
    ):
        get_blended_sample_rate.return_value = 0.1

        releases = [Release.get_or_create(self.project, f"{x}.0") for x in range(1, 4)]

        for release in releases:
            self.redis_client.hset(
                f"ds::p:{self.project.id}:boosted_releases", f"ds::r:{release.id}", time.time()
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
                            {"op": "glob", "name": "trace.release", "value": [release.version]},
                            {
                                "op": "not",
                                "inner": {
                                    "op": "glob",
                                    "name": "trace.environment",
                                    "value": ["*"],
                                },
                            },
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
        assert generate_rules(self.project) == expected
        config_str = json.dumps({"rules": expected})
        validate_sampling_configuration(config_str)
