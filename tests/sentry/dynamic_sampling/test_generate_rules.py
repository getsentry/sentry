import time
from unittest import mock
from unittest.mock import MagicMock, patch

from freezegun import freeze_time
from sentry_relay.processing import validate_sampling_configuration

from sentry.dynamic_sampling.latest_release_booster import get_redis_client_for_ds
from sentry.dynamic_sampling.rules_generator import generate_rules
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
        self.project.update_option(
            "sentry:dynamic_sampling_biases", [{"id": "boostEnvironments", "active": False}]
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

        self.redis_client.hset(f"ds::p:{self.project.id}:boosted_releases", self.release.id, ts)

        expected = [
            {
                "sampleRate": 0.5,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [{"op": "glob", "name": "trace.release", "value": ["foo-1.0"]}],
                },
                "id": 1500,
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
        self.redis_client.hset(f"ds::p:{self.project.id}:boosted_releases", 34345, time.time())
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
    @mock.patch("sentry.dynamic_sampling.rules_generator.BOOSTED_RELEASES_LIMIT", 1)
    def test_generate_rules_return_uniform_rule_with_more_releases_than_the_limit(
        self,
        get_blended_sample_rate,
    ):
        get_blended_sample_rate.return_value = 0.1
        release_2 = self.create_release(self.project, version="foo-2.0")

        self.redis_client.hset(
            f"ds::p:{self.project.id}:boosted_releases", self.release.id, time.time()
        )
        self.redis_client.hset(
            f"ds::p:{self.project.id}:boosted_releases", release_2.id, time.time()
        )

        expected = [
            {
                "sampleRate": 0.5,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [{"op": "glob", "name": "trace.release", "value": ["foo-2.0"]}],
                },
                "id": 1500,
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
