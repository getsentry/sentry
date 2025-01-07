import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from sentry_relay.processing import normalize_project_config

from sentry.constants import HEALTH_CHECK_GLOBS
from sentry.discover.models import TeamKeyTransaction
from sentry.dynamic_sampling import ENVIRONMENT_GLOBS, generate_rules, get_redis_client_for_ds
from sentry.dynamic_sampling.rules.base import NEW_MODEL_THRESHOLD_IN_MINUTES
from sentry.dynamic_sampling.rules.utils import (
    LATEST_RELEASES_BOOST_DECAYED_FACTOR,
    LATEST_RELEASES_BOOST_FACTOR,
    RESERVED_IDS,
    RuleType,
)
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.dynamicsampling import (
    CUSTOM_RULE_DATE_FORMAT,
    CUSTOM_RULE_START,
    CustomDynamicSamplingRule,
)
from sentry.models.projectteam import ProjectTeam
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def latest_release_only(default_old_project):
    """
    This fixture is a hacky way of automatically changing the default project options to use only the latest release
    bias.
    """
    default_old_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": e.value, "active": False}
            for e in RuleType
            if e.value != RuleType.BOOST_LATEST_RELEASES_RULE.value
        ],
    )


@pytest.fixture
def default_old_project(default_project):
    """
    A project created with an old_date.
    """
    return _apply_old_date_to_project_and_org(default_project)


def _apply_old_date_to_project_and_org(project):
    """
    Applies an old date to project and its corresponding org. An old date is determined as a date which is more than
    NEW_MODEL_THRESHOLD_IN_MINUTES minutes in the past.
    """
    old_date = datetime.now(tz=timezone.utc) - timedelta(minutes=NEW_MODEL_THRESHOLD_IN_MINUTES + 1)

    # We have to create the project and organization in the past, since we boost new orgs and projects to 100%
    # automatically.
    project.organization.date_added = old_date
    project.date_added = old_date

    return project


def _validate_rules(project):
    rules = generate_rules(project)

    # Generate boilerplate around minimal project config:
    project_config = {
        "allowedDomains": ["*"],
        "piiConfig": None,
        "trustedRelays": [],
        "sampling": {
            "version": 2,
            "rules": rules,
        },
    }
    assert normalize_project_config(project_config) == project_config


@patch("sentry.dynamic_sampling.rules.base.sentry_sdk")
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_capture_exception(get_blended_sample_rate, sentry_sdk):
    get_blended_sample_rate.return_value = None
    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    fake_project = MagicMock()
    # if blended rate is None that means dynamic sampling rate should be set to 1.
    rules = generate_rules(fake_project)
    assert rules[0]["samplingValue"]["value"] == 1.0
    get_blended_sample_rate.assert_called_with(
        organization_id=fake_project.organization.id, project=fake_project
    )
    _validate_rules(fake_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_only_always_allowed_rules_if_sample_rate_is_100_and_other_rules_are_enabled(
    get_blended_sample_rate, default_old_project
):
    get_blended_sample_rate.return_value = 1.0

    # We also enable the recalibration to show it's not generated as part of the rules.
    redis_client = get_redis_client_for_ds()
    redis_client.set(
        f"ds::o:{default_old_project.organization.id}:rate_rebalance_factor2",
        0.5,
    )

    with Feature("organizations:ds-org-recalibration"):
        assert generate_rules(default_old_project) == [
            {
                "condition": {"inner": [], "op": "and"},
                "id": 1000,
                "samplingValue": {"type": "sampleRate", "value": 1.0},
                "type": "trace",
            },
        ]
        get_blended_sample_rate.assert_called_with(
            organization_id=default_old_project.organization.id, project=default_old_project
        )
        _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.get_enabled_user_biases")
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_with_rate(
    get_blended_sample_rate, get_enabled_user_biases, default_old_project
):
    # it means no enabled user biases
    get_enabled_user_biases.return_value = {}
    get_blended_sample_rate.return_value = 0.1
    assert generate_rules(default_old_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.1},
            "type": "trace",
        },
    ]
    get_enabled_user_biases.assert_called_with(
        default_old_project.get_option("sentry:dynamic_sampling_biases", None)
    )
    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_env_rule(
    get_blended_sample_rate, default_old_project
):
    get_blended_sample_rate.return_value = 0.1
    default_old_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )

    # since we mock get_blended_sample_rate function
    # no need to create real project in DB
    assert generate_rules(default_old_project) == [
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
    get_blended_sample_rate.assert_called_with(
        organization_id=default_old_project.organization.id, project=default_old_project
    )
    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_100_rate_and_without_env_rule(
    get_blended_sample_rate, default_old_project
):
    get_blended_sample_rate.return_value = 1.0

    assert generate_rules(default_old_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        },
    ]
    _validate_rules(default_old_project)


@freeze_time("2022-10-21T18:50:25Z")
@patch("sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.apply_dynamic_factor")
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
@django_db_all
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
    default_old_project = _apply_old_date_to_project_and_org(default_project)

    get_blended_sample_rate.return_value = 0.1
    apply_dynamic_factor.return_value = LATEST_RELEASES_BOOST_FACTOR

    redis_client = get_redis_client_for_ds()

    default_old_project.update(platform=platform)
    release = Factories.create_release(project=default_old_project, version=version)
    environment = "prod"

    redis_client.hset(
        f"ds::p:{default_old_project.id}:boosted_releases",
        f"ds::r:{release.id}:e:{environment}",
        time.time(),
    )

    assert generate_rules(default_old_project) == [
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
    _validate_rules(default_old_project)


@django_db_all
@freeze_time("2022-10-21T18:50:25Z")
@patch("sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.apply_dynamic_factor")
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_latest_release_rule(
    get_blended_sample_rate, apply_dynamic_factor, default_project, latest_release_only
):
    default_old_project = _apply_old_date_to_project_and_org(default_project)

    get_blended_sample_rate.return_value = 0.1
    apply_dynamic_factor.return_value = LATEST_RELEASES_BOOST_FACTOR

    redis_client = get_redis_client_for_ds()

    default_old_project.update(platform="python")
    first_release = Factories.create_release(project=default_old_project, version="1.0")
    for release, environment in (
        (first_release, "prod"),
        (first_release, "dev"),
        (first_release, None),
    ):
        env_postfix = f":e:{environment}" if environment is not None else ""
        redis_client.hset(
            f"ds::p:{default_old_project.id}:boosted_releases",
            f"ds::r:{release.id}{env_postfix}",
            time.time(),
        )

    assert generate_rules(default_old_project) == [
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
    _validate_rules(default_old_project)


@django_db_all
@freeze_time("2022-10-21T18:50:25Z")
@patch("sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.apply_dynamic_factor")
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_does_not_return_rule_with_deleted_release(
    get_blended_sample_rate, apply_dynamic_factor, default_project, latest_release_only
):
    default_old_project = _apply_old_date_to_project_and_org(default_project)

    get_blended_sample_rate.return_value = 0.1
    apply_dynamic_factor.return_value = LATEST_RELEASES_BOOST_FACTOR

    redis_client = get_redis_client_for_ds()

    default_old_project.update(platform="python")
    first_release = Factories.create_release(project=default_old_project, version="1.0")
    second_release = Factories.create_release(project=default_old_project, version="2.0")

    redis_client.hset(
        f"ds::p:{default_old_project.id}:boosted_releases",
        f"ds::r:{first_release.id}",
        time.time(),
    )
    redis_client.hset(
        f"ds::p:{default_old_project.id}:boosted_releases",
        f"ds::r:{second_release.id}",
        time.time(),
    )

    second_release.delete()

    assert generate_rules(default_old_project) == [
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
    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_100_rate_and_without_latest_release_rule(
    get_blended_sample_rate, default_old_project, latest_release_only
):
    get_blended_sample_rate.return_value = 1.0

    default_old_project.update(platform="python")

    assert generate_rules(default_old_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        },
    ]
    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_uniform_rule_with_non_existent_releases(
    get_blended_sample_rate, default_old_project, latest_release_only
):
    get_blended_sample_rate.return_value = 1.0

    redis_client = get_redis_client_for_ds()

    redis_client.hset(
        f"ds::p:{default_old_project.id}:boosted_releases", f"ds::r:{1234}", time.time()
    )

    assert generate_rules(default_old_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 1.0},
            "type": "trace",
        },
    ]
    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_with_zero_base_sample_rate(get_blended_sample_rate, default_old_project):
    get_blended_sample_rate.return_value = 0.0

    assert generate_rules(default_old_project) == [
        {
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "samplingValue": {"type": "sampleRate", "value": 0.0},
            "type": "trace",
        },
    ]
    get_blended_sample_rate.assert_called_with(
        organization_id=default_old_project.organization.id, project=default_old_project
    )
    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_low_volume_transactions_bias.get_transactions_resampling_rates"
)
def test_generate_rules_return_uniform_rules_and_low_volume_transactions_rules(
    get_transactions_resampling_rates, get_blended_sample_rate, default_old_project, default_team
):
    project_sample_rate = 0.1
    t1_rate = 0.7
    implicit_rate = 0.037
    get_blended_sample_rate.return_value = project_sample_rate
    get_transactions_resampling_rates.return_value = {
        "t1": t1_rate,
    }, implicit_rate
    boost_low_transactions_id = RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE]
    uniform_id = RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE]
    default_old_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )
    default_old_project.add_team(default_team)

    TeamKeyTransaction.objects.create(
        organization=default_old_project.organization,
        transaction="/foo",
        project_team=ProjectTeam.objects.get(project=default_old_project, team=default_team),
    )
    rules = generate_rules(default_old_project)
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
    get_blended_sample_rate.assert_called_with(
        organization_id=default_old_project.organization.id, project=default_old_project
    )
    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
@patch(
    "sentry.dynamic_sampling.rules.biases.boost_low_volume_transactions_bias.get_transactions_resampling_rates"
)
def test_low_volume_transactions_rules_not_returned_when_inactive(
    get_transactions_resampling_rates, get_blended_sample_rate, default_old_project, default_team
):
    get_blended_sample_rate.return_value = 0.1
    get_transactions_resampling_rates.return_value = {
        "t1": 0.7,
    }, 0.037
    uniform_id = RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE]

    default_old_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )
    default_old_project.add_team(default_team)

    TeamKeyTransaction.objects.create(
        organization=default_old_project.organization,
        transaction="/foo",
        project_team=ProjectTeam.objects.get(project=default_old_project, team=default_team),
    )
    rules = generate_rules(default_old_project)

    # we should have only the uniform rule
    assert len(rules) == 1
    assert rules[0]["id"] == uniform_id


@django_db_all
@freeze_time("2022-10-21T18:50:25Z")
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_uniform_rules_and_recalibrate_orgs_rule(
    get_blended_sample_rate, default_project
):
    default_old_project = _apply_old_date_to_project_and_org(default_project)

    get_blended_sample_rate.return_value = 0.1
    redis_client = get_redis_client_for_ds()

    default_old_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )

    default_factor = 0.5
    redis_client.set(
        f"ds::o:{default_old_project.organization.id}:rate_rebalance_factor2",
        default_factor,
    )

    with Feature("organizations:ds-org-recalibration"):
        assert generate_rules(default_old_project) == [
            {
                "condition": {"inner": [], "op": "and"},
                "id": 1004,
                "samplingValue": {"type": "factor", "value": default_factor},
                "type": "trace",
            },
            {
                "condition": {"inner": [], "op": "and"},
                "id": 1000,
                "samplingValue": {"type": "sampleRate", "value": 0.1},
                "type": "trace",
            },
        ]
        _validate_rules(default_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_boost_replay_id(get_blended_sample_rate, default_old_project):
    get_blended_sample_rate.return_value = 0.5
    default_old_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE.value, "active": False},
        ],
    )

    assert generate_rules(default_old_project) == [
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

    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_return_custom_rules(get_blended_sample_rate, default_old_project):
    """
    Tests the generation of custom rules ( from CustomDynamicSamplingRule models )
    """
    get_blended_sample_rate.return_value = 0.5
    # turn off other biases
    default_old_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
            {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
            {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE.value, "active": False},
            {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
        ],
    )

    # no custom rule requests ==> no custom rules
    rules = generate_rules(default_old_project)
    # only the BOOST_LOW_VOLUME_PROJECTS_RULE should be around (always on)
    assert len(rules) == 1
    assert rules[0]["id"] == 1000

    # create some custom rules for the project
    start = datetime.now(tz=timezone.utc) - timedelta(hours=1)
    end = datetime.now(tz=timezone.utc) + timedelta(hours=1)
    start_str = start.strftime(CUSTOM_RULE_DATE_FORMAT)
    end_str = end.strftime(CUSTOM_RULE_DATE_FORMAT)

    # a project rule
    condition = {"op": "eq", "name": "environment", "value": "prod1"}
    CustomDynamicSamplingRule.update_or_create(
        condition=condition,
        start=start,
        end=end,
        project_ids=[default_old_project.id],
        organization_id=default_old_project.organization.id,
        num_samples=100,
        sample_rate=0.5,
        query="environment:prod1",
    )
    # and an organization rule
    condition = {"op": "eq", "name": "environment", "value": "prod2"}
    CustomDynamicSamplingRule.update_or_create(
        condition=condition,
        start=start,
        end=end,
        project_ids=[],
        organization_id=default_old_project.organization.id,
        num_samples=100,
        sample_rate=0.5,
        query="environment:prod2",
    )

    rules = generate_rules(default_old_project)
    # now we should have 3 rules the 2 custom rules and the BOOST_LOW_VOLUME_PROJECTS_RULE
    assert len(rules) == 3

    # check which is the org rule and which is the proj rule:
    # project rule should have the first id (i.e. 3001) since it was the first created

    if rules[0]["id"] == CUSTOM_RULE_START + 1:
        project_rule = rules[0]
        org_rule = rules[1]
    else:
        project_rule = rules[1]
        org_rule = rules[0]

    # we have the project rule correctly built
    assert project_rule == {
        "samplingValue": {"type": "reservoir", "limit": 100},
        "type": "transaction",
        "id": CUSTOM_RULE_START + 1,
        "condition": {"op": "eq", "name": "environment", "value": "prod1"},
        "timeRange": {"start": start_str, "end": end_str},
    }
    # we have the org rule correctly built
    assert org_rule == {
        "samplingValue": {"type": "reservoir", "limit": 100},
        "type": "transaction",
        "id": CUSTOM_RULE_START + 2,
        "condition": {"op": "eq", "name": "environment", "value": "prod2"},
        "timeRange": {"start": start_str, "end": end_str},
    }

    # check the last one is the BOOST_LOW_VOLUME_PROJECTS_RULE
    assert rules[2]["id"] == 1000

    _validate_rules(default_old_project)


@django_db_all
@patch("sentry.dynamic_sampling.rules.base.get_enabled_user_biases")
@patch("sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate")
def test_generate_rules_project_mode(
    get_blended_sample_rate, get_enabled_user_biases, default_old_project
):
    # Ensure only the project base rate is generated
    get_enabled_user_biases.return_value = {}

    default_old_project.organization.update_option(
        "sentry:sampling_mode", DynamicSamplingMode.PROJECT
    )
    default_old_project.update_option("sentry:target_sample_rate", 0.2)

    with Feature(
        {"organizations:ds-org-recalibration": True, "organizations:dynamic-sampling-custom": True}
    ):
        assert generate_rules(default_old_project) == [
            {
                "condition": {"inner": [], "op": "and"},
                "id": 1000,
                "samplingValue": {"type": "sampleRate", "value": 0.2},
                "type": "trace",
            },
        ]
        assert not get_blended_sample_rate.called
        _validate_rules(default_old_project)
