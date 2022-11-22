import time
from datetime import datetime, timedelta
from typing import Optional
from unittest import mock
from unittest.mock import MagicMock, patch

from freezegun import freeze_time
from sentry_relay.processing import validate_sampling_configuration

from sentry.dynamic_sampling.latest_release_booster import get_redis_client_for_ds
from sentry.dynamic_sampling.latest_release_ttas import LATEST_RELEASE_TTAS, get_tta_for_platform
from sentry.dynamic_sampling.rules_generator import HEALTH_CHECK_GLOBS, generate_rules
from sentry.models import Release
from sentry.testutils import TestCase
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
    get_enabled_user_biases.return_value = {"id": "boostEnvironments", "active": False}
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


@patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_env_rule(get_blended_sample_rate):
    get_blended_sample_rate.return_value = 0.1
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    assert generate_rules(fake_project) == [
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
    get_blended_sample_rate.assert_called_with(fake_project)


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
        self.redis_client = get_redis_client_for_ds()
        # All different projects per platform, where none means no platform.
        self.none_project = self.project
        self.python_project = self.create_project(platform="python")
        # We now set all the projects options to enable only latest release bias.
        self.none_project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": False},
                {"id": "ignoreHealthChecks", "active": False},
            ],
        )
        self.python_project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": False},
                {"id": "ignoreHealthChecks", "active": False},
            ],
        )

    @staticmethod
    def _get_bias_end_time_from_start_time(start_time: str, platform: Optional[str]) -> str:
        """
        Utils function that returns the end time considering the start time and the platform.

        E.g.: if a platform has the tta of 3600 seconds = 1 hour, we will just sum 1 hour to the start time.
        """
        parsed_start_time = datetime.fromisoformat(start_time)
        return str(parsed_start_time + timedelta(seconds=get_tta_for_platform(platform)))

    @freeze_time("2022-10-21 18:50:25+00:00")
    @patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
    def test_generate_rules_with_different_project_platforms(self, get_blended_sample_rate):
        get_blended_sample_rate.return_value = 0.1

        for index, platform in enumerate(list(LATEST_RELEASE_TTAS.keys()) + [None]):
            project = self.create_project(platform=platform)
            project.update_option(
                "sentry:dynamic_sampling_biases",
                [
                    {"id": "boostEnvironments", "active": False},
                    {"id": "ignoreHealthChecks", "active": False},
                ],
            )

            release = Release.get_or_create(project=project, version=f"{index + 1}.0")

            self.redis_client.hset(
                f"ds::p:{project.id}:boosted_releases",
                f"ds::r:{release.id}:e:{self.environment.name}",
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
                            {"op": "glob", "name": "trace.release", "value": [release.version]},
                            {
                                "op": "glob",
                                "name": "trace.environment",
                                "value": [self.environment.name],
                            },
                        ],
                    },
                    "id": 1500,
                    "timeRange": {
                        "start": "2022-10-21 18:50:25+00:00",
                        "end": self._get_bias_end_time_from_start_time(
                            "2022-10-21 18:50:25+00:00", project.platform
                        ),
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
            assert generate_rules(project) == expected

    @freeze_time("2022-10-21 18:50:25+00:00")
    @patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
    def test_generate_rules_return_uniform_rules_and_latest_release_rule(
        self, get_blended_sample_rate
    ):
        get_blended_sample_rate.return_value = 0.1
        # since we mock get_blended_sample_rate function
        # no need to create real project in DB
        ts = time.time()

        for release, environment in (
            (Release.get_or_create(project=self.python_project, version="1.0"), "prod"),
            (Release.get_or_create(project=self.python_project, version="1.0"), "dev"),
            (Release.get_or_create(project=self.python_project, version="1.0"), None),
        ):
            env_postfix = f":e:{environment}" if environment is not None else ""
            self.redis_client.hset(
                f"ds::p:{self.python_project.id}:boosted_releases",
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
                    "end": self._get_bias_end_time_from_start_time(
                        "2022-10-21 18:50:25+00:00", self.python_project.platform
                    ),
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
                    "end": self._get_bias_end_time_from_start_time(
                        "2022-10-21 18:50:25+00:00", self.python_project.platform
                    ),
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
                    "end": self._get_bias_end_time_from_start_time(
                        "2022-10-21 18:50:25+00:00", self.python_project.platform
                    ),
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

        assert generate_rules(self.python_project) == expected
        config_str = json.dumps({"rules": expected})
        validate_sampling_configuration(config_str)

    @patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
    def test_generate_rules_return_uniform_rule_with_100_rate_and_without_latest_release_rule(
        self,
        get_blended_sample_rate,
    ):
        get_blended_sample_rate.return_value = 1.0
        assert generate_rules(self.none_project) == [
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
            f"ds::p:{self.none_project.id}:boosted_releases", f"ds::r:{1234}", time.time()
        )
        assert generate_rules(self.none_project) == [
            {
                "active": True,
                "condition": {"inner": [], "op": "and"},
                "id": 1000,
                "sampleRate": 1.0,
                "type": "trace",
            },
        ]

    @freeze_time("2022-10-21 18:50:25+00:00")
    @patch("sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate")
    @mock.patch("sentry.dynamic_sampling.rules_generator.BOOSTED_RELEASES_LIMIT", 2)
    def test_generate_rules_return_uniform_rule_with_more_releases_than_the_limit(
        self,
        get_blended_sample_rate,
    ):
        get_blended_sample_rate.return_value = 0.1

        releases = [Release.get_or_create(self.none_project, f"{x}.0") for x in range(1, 4)]

        for release in releases:
            self.redis_client.hset(
                f"ds::p:{self.none_project.id}:boosted_releases", f"ds::r:{release.id}", time.time()
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
