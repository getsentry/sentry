import time
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time
from sentry_relay.processing import validate_project_config

from sentry.discover.models import TeamKeyTransaction
from sentry.dynamic_sampling import (
    ENVIRONMENT_GLOBS,
    HEALTH_CHECK_GLOBS,
    generate_rules,
    get_redis_client_for_ds,
)
from sentry.dynamic_sampling.rules.utils import (
    LATEST_RELEASES_BOOST_DECAYED_FACTOR,
    LATEST_RELEASES_BOOST_FACTOR,
    RESERVED_IDS,
    RuleType,
)
from sentry.models import ProjectTeam
from sentry.testutils.factories import Factories
from sentry.utils import json

DEFAULT_FACTOR_RULE = lambda factor: {
    "condition": {"inner": [], "op": "and"},
    "id": 1004,
    "samplingValue": {"type": "factor", "value": factor},
    "type": "trace",
}


@pytest.fixture
def latest_release_only(default_project):
    """
    This fixture is a hacky way of automatically changing the default project options to use only the latest release
    bias.
    """
    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": e.value, "active": False}
            for e in RuleType
            if e.value != RuleType.BOOST_LATEST_RELEASES_RULE.value
        ],
    )


def _validate_rules(project):
    rules = generate_rules(project)

    # Generate boilerplate around minimal project config:
    project_config = {
        "allowedDomains": ["*"],
        "piiConfig": None,
        "trustedRelays": [],
        "dynamicSampling": {
            "rules": [],
            "rulesV2": rules,
            "mode": "total",
        },
    }
    validate_project_config(json.dumps(project_config), strict=True)


@patch("sentry.dynamic_sampling.rules.base.sentry_sdk")
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_capture_exception(get_blended_sample_rate, sentry_sdk):
    get_blended_sample_rate.return_value = None
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    # if blended rate is None that means no dynamic sampling behavior should happen.
    # Therefore no rules should be set.
    assert generate_rules(fake_project) == []
    get_blended_sample_rate.assert_called_with(organization_id=fake_project.organization.id)
    assert sentry_sdk.capture_exception.call_count == 1
    _validate_rules(fake_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_only_uniform_if_sample_rate_is_100_and_other_rules_are_enabled(
    get_blended_sample_rate, default_project
):
    get_blended_sample_rate.return_value = 1.0

    assert generate_rules(default_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(organization_id=default_project.organization.id)
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.get_enabled_user_biases")
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_with_rate(
    get_blended_sample_rate, get_enabled_user_biases, default_project
):
    # it means no enabled user biases
    get_enabled_user_biases.return_value = {}
    get_blended_sample_rate.return_value = 0.1
    assert generate_rules(default_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.1},
            "type": "trace",
        },
    ]
    get_enabled_user_biases.assert_called_with(
        default_project.get_option("sentry:dynamic_sampling_biases", None)
    )
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_env_rule(get_blended_sample_rate, default_project):
    get_blended_sample_rate.return_value = 0.1
    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )

    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    assert generate_rules(default_project) == [
        {
            "samplingValue": {"type": "sampleRate", "value": 0.02},
            "type": "transaction",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "glob",
                        "name": "event.transaction",
                        "value": HEALTH_CHECK_GLOBS,
                    }
                ],
            },
            "id": 1002,
        },
        {
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "glob",
                        "name": "trace.environment",
                        "value": ENVIRONMENT_GLOBS,
                    }
                ],
            },
            "id": 1001,
        },
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.1},
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(organization_id=default_project.organization.id)
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_100_rate_and_without_env_rule(
    get_blended_sample_rate, default_project
):
    get_blended_sample_rate.return_value = 1.0

    assert generate_rules(default_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        },
    ]
    _validate_rules(default_project)


@freeze_time("2022-10-21T18:50:25Z")
@patch("sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.apply_dynamic_factor")
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
@pytest.mark.django_db
@pytest.mark.parametrize(
    ["version", "platform", "end"],
    [
        (version, platform, end)
        for version, platform, end in [
            ("1.0", "python", "2022-10-21T20:03:03Z"),
            ("2.0", None, "2022-10-21T19:50:25Z"),
        ]
    ],
)
def test_generate_rules_with_different_project_platforms(
    get_blended_sample_rate,
    apply_dynamic_factor,
    version,
    platform,
    end,
    default_project,
    latest_release_only,
):
    get_blended_sample_rate.return_value = 0.1
    apply_dynamic_factor.return_value = LATEST_RELEASES_BOOST_FACTOR

    redis_client = get_redis_client_for_ds()

    default_project.update(platform=platform)
    release = Factories.create_release(project=default_project, version=version)
    environment = "prod"

    redis_client.hset(
        f"ds::p:{default_project.id}:boosted_releases",
        f"ds::r:{release.id}:e:{environment}",
        time.time(),
    )

    assert generate_rules(default_project) == [
        {
            "samplingValue": {"type": "factor", "value": LATEST_RELEASES_BOOST_FACTOR},
            "type": "trace",
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
                "start": "2022-10-21T18:50:25Z",
                "end": end,
            },
            "decayingFn": {"type": "linear", "decayedValue": LATEST_RELEASES_BOOST_DECAYED_FACTOR},
        },
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.1},
            "type": "trace",
        },
    ]
    _validate_rules(default_project)


@pytest.mark.django_db
@freeze_time("2022-10-21T18:50:25Z")
@patch("sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.apply_dynamic_factor")
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_latest_release_rule(
    get_blended_sample_rate, apply_dynamic_factor, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 0.1
    apply_dynamic_factor.return_value = LATEST_RELEASES_BOOST_FACTOR

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

    assert generate_rules(default_project) == [
        {
            "samplingValue": {"type": "factor", "value": LATEST_RELEASES_BOOST_FACTOR},
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                    {"op": "eq", "name": "trace.environment", "value": "prod"},
                ],
            },
            "id": 1500,
            "timeRange": {"start": "2022-10-21T18:50:25Z", "end": "2022-10-21T20:03:03Z"},
            "decayingFn": {"type": "linear", "decayedValue": LATEST_RELEASES_BOOST_DECAYED_FACTOR},
        },
        {
            "samplingValue": {"type": "factor", "value": LATEST_RELEASES_BOOST_FACTOR},
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                    {"op": "eq", "name": "trace.environment", "value": "dev"},
                ],
            },
            "id": 1501,
            "timeRange": {"start": "2022-10-21T18:50:25Z", "end": "2022-10-21T20:03:03Z"},
            "decayingFn": {"type": "linear", "decayedValue": LATEST_RELEASES_BOOST_DECAYED_FACTOR},
        },
        {
            "samplingValue": {"type": "factor", "value": LATEST_RELEASES_BOOST_FACTOR},
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                    {"op": "eq", "name": "trace.environment", "value": None},
                ],
            },
            "id": 1502,
            "timeRange": {"start": "2022-10-21T18:50:25Z", "end": "2022-10-21T20:03:03Z"},
            "decayingFn": {"type": "linear", "decayedValue": LATEST_RELEASES_BOOST_DECAYED_FACTOR},
        },
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.1},
            "type": "trace",
        },
    ]
    _validate_rules(default_project)


@pytest.mark.django_db
@freeze_time("2022-10-21T18:50:25Z")
@patch("sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.apply_dynamic_factor")
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_does_not_return_rule_with_deleted_release(
    get_blended_sample_rate, apply_dynamic_factor, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 0.1
    apply_dynamic_factor.return_value = LATEST_RELEASES_BOOST_FACTOR

    redis_client = get_redis_client_for_ds()

    default_project.update(platform="python")
    first_release = Factories.create_release(project=default_project, version="1.0")
    second_release = Factories.create_release(project=default_project, version="2.0")

    redis_client.hset(
        f"ds::p:{default_project.id}:boosted_releases",
        f"ds::r:{first_release.id}",
        time.time(),
    )
    redis_client.hset(
        f"ds::p:{default_project.id}:boosted_releases",
        f"ds::r:{second_release.id}",
        time.time(),
    )

    second_release.delete()

    assert generate_rules(default_project) == [
        {
            "samplingValue": {"type": "factor", "value": LATEST_RELEASES_BOOST_FACTOR},
            "type": "trace",
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                    {"op": "eq", "name": "trace.environment", "value": None},
                ],
            },
            "id": 1500,
            "timeRange": {"start": "2022-10-21T18:50:25Z", "end": "2022-10-21T20:03:03Z"},
            "decayingFn": {"type": "linear", "decayedValue": LATEST_RELEASES_BOOST_DECAYED_FACTOR},
        },
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.1},
            "type": "trace",
        },
    ]
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_100_rate_and_without_latest_release_rule(
    get_blended_sample_rate, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 1.0

    default_project.update(platform="python")

    assert generate_rules(default_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        },
    ]
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_non_existent_releases(
    get_blended_sample_rate, default_project, latest_release_only
):
    get_blended_sample_rate.return_value = 1.0

    redis_client = get_redis_client_for_ds()

    redis_client.hset(f"ds::p:{default_project.id}:boosted_releases", f"ds::r:{1234}", time.time())

    assert generate_rules(default_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        },
    ]
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_with_zero_base_sample_rate(get_blended_sample_rate, default_project):
    get_blended_sample_rate.return_value = 0.0

    assert generate_rules(default_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.0},
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(organization_id=default_project.organization.id)
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_rare_transactions_rule.get_transactions_resampling_rates"
)
def test_generate_rules_return_uniform_rules_and_low_volume_transactions_rules(
    get_transactions_resampling_rates, get_blended_sample_rate, default_project, default_team
):
    project_sample_rate = 0.1
    t1_rate = 0.7
    implicit_rate = 0.037
    get_blended_sample_rate.return_value = project_sample_rate
    get_transactions_resampling_rates.return_value = {
        "t1": t1_rate,
    }, implicit_rate
    boost_low_transactions_id = RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS]
    uniform_id = RESERVED_IDS[RuleType.UNIFORM_RULE]
    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )
    default_project.add_team(default_team)

    TeamKeyTransaction.objects.create(
        organization=default_project.organization,
        transaction="/foo",
        project_team=ProjectTeam.objects.get(project=default_project, team=default_team),
    )
    rules = generate_rules(default_project)
    implicit_rate /= project_sample_rate
    t1_rate /= project_sample_rate
    t1_rate /= implicit_rate
    assert rules == [
        # transaction boosting rule
        {
            "condition": {
                "inner": [
                    {
                        "name": "trace.transaction",
                        "op": "eq",
                        "options": {"ignoreCase": True},
                        "value": ["t1"],
                    }
                ],
                "op": "or",
            },
            "id": boost_low_transactions_id,
            "samplingValue": {"type": "factor", "value": t1_rate},
            "type": "trace",
        },
        {
            "condition": {"inner": [], "op": "and"},
            "id": boost_low_transactions_id + 1,
            "samplingValue": {"type": "factor", "value": implicit_rate},
            "type": "trace",
        },
        {
            "condition": {"inner": [], "op": "and"},
            "id": uniform_id,
            "samplingValue": {"type": "sampleRate", "value": project_sample_rate},
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(organization_id=default_project.organization.id)
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_rare_transactions_rule.get_transactions_resampling_rates"
)
def test_low_volume_transactions_rules_not_returned_when_inactive(
    get_transactions_resampling_rates, get_blended_sample_rate, default_project, default_team
):
    get_blended_sample_rate.return_value = 0.1
    get_transactions_resampling_rates.return_value = {
        "t1": 0.7,
    }, 0.037
    uniform_id = RESERVED_IDS[RuleType.UNIFORM_RULE]

    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS.value, "active": False},
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )
    default_project.add_team(default_team)

    TeamKeyTransaction.objects.create(
        organization=default_project.organization,
        transaction="/foo",
        project_team=ProjectTeam.objects.get(project=default_project, team=default_team),
    )
    rules = generate_rules(default_project)

    # we should have only the uniform rule
    assert len(rules) == 1
    assert rules[0]["id"] == uniform_id


@pytest.mark.skip("Disabled rebalancing rule.")
@pytest.mark.django_db
@freeze_time("2022-10-21T18:50:25Z")
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_rebalance_factor_rule(
    get_blended_sample_rate, default_project
):
    get_blended_sample_rate.return_value = 0.1
    redis_client = get_redis_client_for_ds()

    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS.value, "active": False},
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )

    # Set factor
    default_factor = 0.5
    redis_client.set(
        f"ds::o:{default_project.organization.id}:rate_rebalance_factor2",
        default_factor,
    )
    assert generate_rules(default_project) == [
        DEFAULT_FACTOR_RULE(default_factor),
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.1},
            "type": "trace",
        },
    ]
    _validate_rules(default_project)


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
def test_generate_rules_return_boost_replay_id(get_blended_sample_rate, default_project):
    get_blended_sample_rate.return_value = 0.5
    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS.value, "active": False},
        ],
    )

    assert generate_rules(default_project) == [
        {
            "condition": {
                "inner": {
                    "name": "trace.replay_id",
                    "op": "eq",
                    "value": None,
                    "options": {"ignoreCase": True},
                },
                "op": "not",
            },
            "id": 1005,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        },
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.5},
            "type": "trace",
        },
    ]

    _validate_rules(default_project)
