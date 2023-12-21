import time
from datetime import datetime, timedelta, timezone
from unittest import mock
from unittest.mock import ANY, patch

import pytest
from sentry_relay.processing import validate_project_config

from sentry.constants import HEALTH_CHECK_GLOBS, ObjectStatus
from sentry.discover.models import TeamKeyTransaction
from sentry.dynamic_sampling import (
    ENVIRONMENT_GLOBS,
    RESERVED_IDS,
    Platform,
    RuleType,
    get_redis_client_for_ds,
)
from sentry.dynamic_sampling.rules.base import NEW_MODEL_THRESHOLD_IN_MINUTES
from sentry.models.projectkey import ProjectKey
from sentry.models.projectteam import ProjectTeam
from sentry.models.transaction_threshold import TransactionMetric
from sentry.relay.config import ProjectConfig, get_project_config
from sentry.snuba.dataset import Dataset
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from sentry.utils.safe import get_path

PII_CONFIG = """
{
  "rules": {
    "remove_ips_and_macs": {
      "type": "multiple",
      "rules": [
        "@ip",
        "@mac"
      ],
      "redaction": {
        "method": "remove"
      }
    }
  },
  "applications": {
    "$string": ["remove_ips_and_macs"]
  }
}
"""

DEFAULT_ENVIRONMENT_RULE = {
    "sampleRate": 1,
    "type": "trace",
    "condition": {
        "op": "or",
        "inner": [
            {
                "op": "glob",
                "name": "trace.environment",
                "value": ENVIRONMENT_GLOBS,
                "options": {"ignoreCase": True},
            }
        ],
    },
    "id": 1001,
}

DEFAULT_IGNORE_HEALTHCHECKS_RULE = {
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
    "id": RESERVED_IDS[RuleType.IGNORE_HEALTH_CHECKS_RULE],
}


def _validate_project_config(config):
    # Relay keeps BTreeSets for these, so sort here as well:
    for rule in config.get("metricConditionalTagging", []):
        rule["targetMetrics"] = sorted(rule["targetMetrics"])

    validate_project_config(json.dumps(config), strict=True)


@django_db_all
@region_silo_test
def test_get_project_config_non_visible(default_project):
    keys = ProjectKey.objects.filter(project=default_project)
    default_project.update(status=ObjectStatus.PENDING_DELETION)
    cfg = get_project_config(default_project, full_config=True, project_keys=keys)
    assert cfg.to_dict() == {"disabled": True}


@django_db_all
@region_silo_test
@pytest.mark.parametrize("full", [False, True], ids=["slim_config", "full_config"])
def test_get_project_config(default_project, insta_snapshot, django_cache, full):
    # We could use the default_project fixture here, but we would like to avoid 1) hitting the db 2) creating a mock
    default_project.update_option("sentry:relay_pii_config", PII_CONFIG)
    default_project.organization.update_option("sentry:relay_pii_config", PII_CONFIG)
    keys = ProjectKey.objects.filter(project=default_project)

    project_cfg = get_project_config(default_project, full_config=full, project_keys=keys)
    cfg = project_cfg.to_dict()

    _validate_project_config(cfg["config"])

    # Remove keys that change everytime
    cfg.pop("lastChange")
    cfg.pop("lastFetch")
    cfg.pop("rev")

    # public keys change every time
    assert cfg.pop("projectId") == default_project.id
    assert len(cfg.pop("publicKeys")) == len(keys)
    assert cfg.pop("organizationId") == default_project.organization.id

    insta_snapshot(cfg)


SOME_EXCEPTION = RuntimeError("foo")


@django_db_all
@region_silo_test
@mock.patch("sentry.relay.config.generate_rules", side_effect=SOME_EXCEPTION)
@mock.patch("sentry.relay.config.logger")
def test_get_experimental_config_dyn_sampling(mock_logger, _, default_project):
    keys = ProjectKey.objects.filter(project=default_project)
    with Feature({"organizations:dynamic-sampling": True}):
        # Does not raise:
        cfg = get_project_config(default_project, full_config=True, project_keys=keys)
    # Check that the "sampling" key is missing from config. It used to be called
    # "dynamicSampling", so we also test for that:
    subconfig = cfg.to_dict()["config"]
    assert "dynamicSampling" not in subconfig and "sampling" not in subconfig
    assert mock_logger.exception.call_args == mock.call(ANY)


@django_db_all
@region_silo_test
@mock.patch("sentry.relay.config.capture_exception")
def test_get_experimental_config_transaction_metrics_exception(
    mock_capture_exception, default_project
):
    keys = ProjectKey.objects.filter(project=default_project)
    default_project.update_option("sentry:breakdowns", {"invalid_breakdowns": "test"})
    # wrong type
    default_project.update_option("sentry:transaction_metrics_custom_tags", 42)

    with Feature({"organizations:transaction-metrics-extraction": True}):
        cfg = get_project_config(default_project, full_config=True, project_keys=keys)

    config = cfg.to_dict()["config"]

    assert config["transactionMetrics"]["extractCustomTags"] == []
    assert mock_capture_exception.call_count == 2


@django_db_all
@region_silo_test
@pytest.mark.parametrize("has_custom_filters", [False, True])
@pytest.mark.parametrize("has_blacklisted_ips", [False, True])
def test_project_config_uses_filter_features(
    default_project, has_custom_filters, has_blacklisted_ips
):
    error_messages = ["some_error"]
    releases = ["1.2.3", "4.5.6"]
    blacklisted_ips = ["112.69.248.54"]
    default_project.update_option("sentry:error_messages", error_messages)
    default_project.update_option("sentry:releases", releases)
    default_project.update_option("filters:react-hydration-errors", "0")
    default_project.update_option("filters:chunk-load-error", "0")

    if has_blacklisted_ips:
        default_project.update_option("sentry:blacklisted_ips", blacklisted_ips)

    with Feature({"projects:custom-inbound-filters": has_custom_filters}):
        project_cfg = get_project_config(default_project, full_config=True)

    cfg = project_cfg.to_dict()
    _validate_project_config(cfg["config"])
    cfg_error_messages = get_path(cfg, "config", "filterSettings", "errorMessages")
    cfg_releases = get_path(cfg, "config", "filterSettings", "releases")
    cfg_client_ips = get_path(cfg, "config", "filterSettings", "clientIps")

    if has_custom_filters:
        assert {"patterns": error_messages} == cfg_error_messages
        assert {"releases": releases} == cfg_releases
    else:
        assert cfg_releases is None
        assert cfg_error_messages is None

    if has_blacklisted_ips:
        assert {"blacklistedIps": ["112.69.248.54"]} == cfg_client_ips
    else:
        assert cfg_client_ips is None


@django_db_all
@region_silo_test
def test_project_config_with_react_hydration_errors_filter(default_project):
    default_project.update_option("filters:chunk-load-error", "0")

    # We want to test both string and boolean option representations. See implementation for more details
    # on this.
    for value in ("1", True):
        default_project.update_option("filters:react-hydration-errors", value)
        project_cfg = get_project_config(default_project, full_config=True)

        cfg = project_cfg.to_dict()
        _validate_project_config(cfg["config"])
        cfg_error_messages = get_path(cfg, "config", "filterSettings", "errorMessages")

        assert len(cfg_error_messages) == 1


@django_db_all
@region_silo_test
def test_project_config_with_chunk_load_error_filter(default_project):
    default_project.update_option("filters:react-hydration-errors", "0")
    default_project.update_option("filters:chunk-load-error", "1")

    project_cfg = get_project_config(default_project, full_config=True)

    cfg = project_cfg.to_dict()
    _validate_project_config(cfg["config"])
    cfg_error_messages = get_path(cfg, "config", "filterSettings", "errorMessages")

    assert len(cfg_error_messages) == 1


@django_db_all
@region_silo_test
@mock.patch("sentry.relay.config.EXPOSABLE_FEATURES", ["organizations:profiling"])
def test_project_config_exposed_features(default_project):
    with Feature({"organizations:profiling": True}):
        project_cfg = get_project_config(default_project, full_config=True)

    cfg = project_cfg.to_dict()
    _validate_project_config(cfg["config"])
    cfg_features = get_path(cfg, "config", "features")
    assert cfg_features == ["organizations:profiling"]


@django_db_all
@region_silo_test
@mock.patch("sentry.relay.config.EXPOSABLE_FEATURES", ["badprefix:custom-inbound-filters"])
def test_project_config_exposed_features_raise_exc(default_project):
    with Feature({"projects:custom-inbound-filters": True}):
        with pytest.raises(RuntimeError) as exc_info:
            get_project_config(default_project, full_config=True)
        assert (
            str(exc_info.value)
            == "EXPOSABLE_FEATURES must start with 'organizations:' or 'projects:'"
        )


@django_db_all
@region_silo_test
@patch("sentry.dynamic_sampling.rules.biases.boost_latest_releases_bias.apply_dynamic_factor")
@freeze_time("2022-10-21 18:50:25.000000+00:00")
def test_project_config_with_all_biases_enabled(
    eval_dynamic_factor_lr, default_project, default_team
):
    """
    Tests that dynamic sampling information return correct uniform rules
    """
    eval_dynamic_factor_lr.return_value = 1.5

    redis_client = get_redis_client_for_ds()
    ts = time.time()

    # We enable all biases for this project.
    default_project.update_option(
        "sentry:dynamic_sampling_biases",
        [
            {"id": "boostEnvironments", "active": True},
            {"id": "ignoreHealthChecks", "active": True},
            {"id": "boostLatestRelease", "active": True},
        ],
    )
    default_project.add_team(default_team)
    # We have to create the project and organization in the past, since we boost new orgs and projects to 100%
    # automatically.
    old_date = datetime.now(tz=timezone.utc) - timedelta(minutes=NEW_MODEL_THRESHOLD_IN_MINUTES + 1)
    default_project.organization.date_added = old_date
    default_project.date_added = old_date

    # We create a team key transaction.
    TeamKeyTransaction.objects.create(
        organization=default_project.organization,
        transaction="/foo",
        project_team=ProjectTeam.objects.get(project=default_project, team=default_team),
    )

    release_ids = []
    for release_version in ("1.0", "2.0", "3.0"):
        release = Factories.create_release(
            project=default_project,
            version=release_version,
        )
        release_ids.append(release.id)

    # We mark the first release (1.0) as expired.
    time_to_adoption = Platform(default_project.platform).time_to_adoption
    boosted_releases = [(release_ids[0], ts - time_to_adoption * 2)]
    for release_id in release_ids[1:]:
        boosted_releases.append((release_id, ts))

    for release, timestamp in boosted_releases:
        redis_client.hset(
            f"ds::p:{default_project.id}:boosted_releases",
            f"ds::r:{release}:e:prod",
            timestamp,
        )

    # Set factor
    default_factor = 0.5
    redis_client.set(
        f"ds::o:{default_project.organization.id}:rate_rebalance_factor2", default_factor
    )

    with Feature(
        {
            "organizations:dynamic-sampling": True,
        }
    ):
        with patch(
            "sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate",
            return_value=0.1,
        ):
            project_cfg = get_project_config(default_project)

    cfg = project_cfg.to_dict()
    _validate_project_config(cfg["config"])
    dynamic_sampling = get_path(cfg, "config", "sampling")
    assert dynamic_sampling == {
        "version": 2,
        "rules": [
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
                "condition": {
                    "inner": {
                        "name": "trace.replay_id",
                        "op": "eq",
                        "options": {"ignoreCase": True},
                        "value": None,
                    },
                    "op": "not",
                },
                "id": 1005,
                "samplingValue": {"type": "sampleRate", "value": 1.0},
                "type": "trace",
            },
            # {
            #     "condition": {"inner": [], "op": "and"},
            #     "id": 1004,
            #     "samplingValue": {"type": "factor", "value": default_factor},
            #     "type": "trace",
            # },
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
                "samplingValue": {"type": "factor", "value": 1.5},
                "type": "trace",
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "eq", "name": "trace.release", "value": ["2.0"]},
                        {
                            "op": "eq",
                            "name": "trace.environment",
                            "value": "prod",
                        },
                    ],
                },
                "id": 1500,
                "timeRange": {
                    "start": "2022-10-21T18:50:25Z",
                    "end": "2022-10-21T19:50:25Z",
                },
                "decayingFn": {"type": "linear", "decayedValue": 1.0},
            },
            {
                "samplingValue": {"type": "factor", "value": 1.5},
                "type": "trace",
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "eq", "name": "trace.release", "value": ["3.0"]},
                        {
                            "op": "eq",
                            "name": "trace.environment",
                            "value": "prod",
                        },
                    ],
                },
                "id": 1501,
                "timeRange": {
                    "start": "2022-10-21T18:50:25Z",
                    "end": "2022-10-21T19:50:25Z",
                },
                "decayingFn": {"type": "linear", "decayedValue": 1.0},
            },
            {
                "samplingValue": {"type": "sampleRate", "value": 0.1},
                "type": "trace",
                "condition": {"op": "and", "inner": []},
                "id": 1000,
            },
        ],
    }


@django_db_all
@pytest.mark.parametrize("transaction_metrics", ("with_metrics", "without_metrics"))
@region_silo_test
def test_project_config_with_breakdown(default_project, insta_snapshot, transaction_metrics):
    with Feature(
        {
            "organizations:transaction-metrics-extraction": transaction_metrics == "with_metrics",
        }
    ):
        project_cfg = get_project_config(default_project, full_config=True)

    cfg = project_cfg.to_dict()
    _validate_project_config(cfg["config"])
    insta_snapshot(
        {
            "breakdownsV2": cfg["config"]["breakdownsV2"],
            "transactionMetrics": cfg["config"].get("transactionMetrics"),
            "metricConditionalTagging": cfg["config"].get("metricConditionalTagging"),
        }
    )


@django_db_all
@region_silo_test
@pytest.mark.parametrize("has_metrics_extraction", (True, False))
@pytest.mark.parametrize("abnormal_mechanism_rollout", (0, 1))
def test_project_config_with_organizations_metrics_extraction(
    default_project, set_sentry_option, abnormal_mechanism_rollout, has_metrics_extraction
):
    with set_sentry_option(
        "sentry-metrics.releasehealth.abnormal-mechanism-extraction-rate",
        abnormal_mechanism_rollout,
    ):
        with Feature({"organizations:metrics-extraction": has_metrics_extraction}):
            project_cfg = get_project_config(default_project, full_config=True)

        cfg = project_cfg.to_dict()
        _validate_project_config(cfg["config"])
        session_metrics = get_path(cfg, "config", "sessionMetrics")
        if has_metrics_extraction:
            assert session_metrics == {
                "drop": False,
                "version": 2 if abnormal_mechanism_rollout else 1,
            }
        else:
            assert session_metrics is None


@django_db_all
@pytest.mark.parametrize("has_project_transaction_threshold", (False, True))
@pytest.mark.parametrize("has_project_transaction_threshold_overrides", (False, True))
@region_silo_test
def test_project_config_satisfaction_thresholds(
    default_project,
    insta_snapshot,
    has_project_transaction_threshold_overrides,
    has_project_transaction_threshold,
):
    if has_project_transaction_threshold:
        default_project.projecttransactionthreshold_set.create(
            organization=default_project.organization,
            threshold=500,
            metric=TransactionMetric.LCP.value,
        )
    if has_project_transaction_threshold_overrides:
        default_project.projecttransactionthresholdoverride_set.create(
            organization=default_project.organization,
            transaction="foo",
            threshold=400,
            metric=TransactionMetric.DURATION.value,
        )
        default_project.projecttransactionthresholdoverride_set.create(
            organization=default_project.organization,
            transaction="bar",
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )
    with Feature(
        {
            "organizations:transaction-metrics-extraction": True,
        }
    ):
        project_cfg = get_project_config(default_project, full_config=True)

    cfg = project_cfg.to_dict()
    _validate_project_config(cfg["config"])
    insta_snapshot(cfg["config"]["metricConditionalTagging"])


@django_db_all
@region_silo_test
def test_project_config_with_span_attributes(default_project, insta_snapshot):
    # The span attributes config is not set with the flag turnd off
    project_cfg = get_project_config(default_project, full_config=True)
    cfg = project_cfg.to_dict()
    _validate_project_config(cfg["config"])
    insta_snapshot(cfg["config"]["spanAttributes"])


@django_db_all
@region_silo_test
@pytest.mark.parametrize("feature_flag", (False, True), ids=("feature_disabled", "feature_enabled"))
@pytest.mark.parametrize(
    "killswitch", (False, True), ids=("killswitch_disabled", "killswitch_enabled")
)
def test_has_metric_extraction(default_project, feature_flag, killswitch):
    options = override_options(
        {
            "relay.drop-transaction-metrics": [{"project_id": default_project.id}]
            if killswitch
            else []
        }
    )
    feature = Feature(
        {
            "organizations:transaction-metrics-extraction": feature_flag,
        }
    )
    with feature, options:
        project_config = get_project_config(default_project)
        config = project_config.to_dict()["config"]
        _validate_project_config(config)
        if killswitch or not feature_flag:
            assert "transactionMetrics" not in config
        else:
            config = config["transactionMetrics"]
            assert config["customMeasurements"]["limit"] > 0


@django_db_all
def test_accept_transaction_names(default_project):
    feature = Feature(
        {
            "organizations:transaction-metrics-extraction": True,
        }
    )
    with feature:
        config = get_project_config(default_project).to_dict()["config"]

        _validate_project_config(config)
        transaction_metrics_config = config["transactionMetrics"]

        assert transaction_metrics_config["acceptTransactionNames"] == "clientBased"


@pytest.mark.parametrize("num_clusterer_runs", [9, 10])
@django_db_all
def test_txnames_ready(default_project, num_clusterer_runs):
    with mock.patch(
        "sentry.relay.config.get_clusterer_meta", return_value={"runs": num_clusterer_runs}
    ):
        config = get_project_config(default_project).to_dict()["config"]
    _validate_project_config(config)
    if num_clusterer_runs == 9:
        assert "txNameReady" not in config
    elif num_clusterer_runs == 10:
        assert config["txNameReady"] is True


@django_db_all
@region_silo_test
def test_project_config_setattr(default_project):
    project_cfg = ProjectConfig(default_project)
    with pytest.raises(Exception) as exc_info:
        project_cfg.foo = "bar"
    assert str(exc_info.value) == "Trying to change read only ProjectConfig object"


@django_db_all
@region_silo_test
def test_project_config_getattr(default_project):
    project_cfg = ProjectConfig(default_project, foo="bar")
    assert project_cfg.foo == "bar"


@django_db_all
@region_silo_test
def test_project_config_str(default_project):
    project_cfg = ProjectConfig(default_project, foo="bar")
    assert str(project_cfg) == '{"foo":"bar"}'

    with mock.patch.object(ProjectConfig, "to_dict") as fake_to_dict:
        fake_to_dict.side_effect = ValueError("bad data")
        project_cfg1 = ProjectConfig(default_project)
        assert str(project_cfg1) == "Content Error:bad data"


@django_db_all
@region_silo_test
def test_project_config_repr(default_project):
    project_cfg = ProjectConfig(default_project, foo="bar")
    assert repr(project_cfg) == '(ProjectConfig){"foo":"bar"}'


@django_db_all
@region_silo_test
def test_project_config_to_json_string(default_project):
    project_cfg = ProjectConfig(default_project, foo="bar")
    assert project_cfg.to_json_string() == '{"foo":"bar"}'


@django_db_all
@region_silo_test
def test_project_config_get_at_path(default_project):
    project_cfg = ProjectConfig(default_project, a=1, b="The b", foo="bar")
    assert project_cfg.get_at_path("b") == "The b"
    assert project_cfg.get_at_path("bb") is None
    assert project_cfg.get_at_path("b", "c") is None
    assert project_cfg.get_at_path() == project_cfg


@django_db_all
@pytest.mark.parametrize(
    "health_check_set",
    [True, False],
    ids=["healthcheck set", "healthcheck not set"],
)
def test_healthcheck_filter(default_project, health_check_set):
    """
    Tests that the project config properly returns healthcheck filters when the
    user has enabled healthcheck filters.
    """

    default_project.update_option("filters:filtered-transaction", "1" if health_check_set else "0")
    config = get_project_config(default_project).to_dict()["config"]

    _validate_project_config(config)
    filter_settings = get_path(config, "filterSettings")
    config_has_health_check = "ignoreTransactions" in filter_settings
    assert config_has_health_check == health_check_set
    if health_check_set:
        health_check_config = filter_settings["ignoreTransactions"]
        # healthcheck is enabled
        assert health_check_config["isEnabled"]
        # we have some patterns
        assert len(health_check_config["patterns"]) > 1


@django_db_all
def test_alert_metric_extraction_rules_empty(default_project):
    features = {
        "organizations:transaction-metrics-extraction": True,
        "organizations:on-demand-metrics-extraction": True,
    }

    with Feature(features):
        config = get_project_config(default_project).to_dict()["config"]
        validate_project_config(json.dumps(config), strict=False)
        assert "metricExtraction" not in config


@django_db_all
def test_alert_metric_extraction_rules(default_project, factories):
    # Alert compatible with out-of-the-box metrics. This should NOT be included
    # in the config.
    factories.create_alert_rule(
        default_project.organization,
        [default_project],
        query="event.type:transaction environment:production",
        dataset=Dataset.Transactions,
    )

    # Alert requiring an on-demand metric. This should be included in the config.
    factories.create_alert_rule(
        default_project.organization,
        [default_project],
        query="event.type:transaction transaction.duration:<10m",
        dataset=Dataset.PerformanceMetrics,
    )

    features = {
        "organizations:transaction-metrics-extraction": True,
        "organizations:on-demand-metrics-extraction": True,
    }

    with Feature(features):
        config = get_project_config(default_project).to_dict()["config"]
        validate_project_config(json.dumps(config), strict=False)
        assert config["metricExtraction"] == {
            "version": 2,
            "metrics": [
                {
                    "category": "transaction",
                    "mri": "c:transactions/on_demand@none",
                    "field": None,
                    "condition": {"name": "event.duration", "op": "lt", "value": 600000.0},
                    "tags": [{"key": "query_hash", "value": ANY}],
                }
            ],
        }


@django_db_all
def test_performance_calculate_score(default_project):
    features = {
        "organizations:performance-calculate-score-relay": True,
    }

    with Feature(features):
        config = get_project_config(default_project, full_config=True).to_dict()["config"]

        validate_project_config(json.dumps(config), strict=True)
        performance_score = config["performanceScore"]["profiles"]
        assert performance_score[0] == {
            "name": "Chrome",
            "scoreComponents": [
                {"measurement": "fcp", "weight": 0.15, "p10": 900, "p50": 1600, "optional": False},
                {"measurement": "lcp", "weight": 0.3, "p10": 1200, "p50": 2400, "optional": False},
                {
                    "measurement": "fid",
                    "weight": 0.3,
                    "p10": 100,
                    "p50": 300,
                    "optional": True,
                },
                {"measurement": "cls", "weight": 0.15, "p10": 0.1, "p50": 0.25, "optional": False},
                {"measurement": "ttfb", "weight": 0.1, "p10": 200, "p50": 400, "optional": False},
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Chrome",
            },
        }
        assert performance_score[1] == {
            "name": "Firefox",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 900.0,
                    "p50": 1600.0,
                    "optional": False,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.0,
                    "p10": 1200.0,
                    "p50": 2400.0,
                    "optional": False,
                },
                {
                    "measurement": "fid",
                    "weight": 0.3,
                    "p10": 100.0,
                    "p50": 300.0,
                    "optional": True,
                },
                {"measurement": "cls", "weight": 0.0, "p10": 0.1, "p50": 0.25, "optional": False},
                {
                    "measurement": "ttfb",
                    "weight": 0.1,
                    "p10": 200.0,
                    "p50": 400.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Firefox",
            },
        }
        assert performance_score[2] == {
            "name": "Safari",
            "scoreComponents": [
                {
                    "measurement": "fcp",
                    "weight": 0.15,
                    "p10": 900.0,
                    "p50": 1600.0,
                    "optional": False,
                },
                {
                    "measurement": "lcp",
                    "weight": 0.0,
                    "p10": 1200.0,
                    "p50": 2400.0,
                    "optional": False,
                },
                {
                    "measurement": "fid",
                    "weight": 0.0,
                    "p10": 100.0,
                    "p50": 300.0,
                    "optional": True,
                },
                {"measurement": "cls", "weight": 0.0, "p10": 0.1, "p50": 0.25, "optional": False},
                {
                    "measurement": "ttfb",
                    "weight": 0.1,
                    "p10": 200.0,
                    "p50": 400.0,
                    "optional": False,
                },
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Safari",
            },
        }
        assert performance_score[3] == {
            "name": "Edge",
            "scoreComponents": [
                {"measurement": "fcp", "weight": 0.15, "p10": 900, "p50": 1600, "optional": False},
                {"measurement": "lcp", "weight": 0.3, "p10": 1200, "p50": 2400, "optional": False},
                {
                    "measurement": "fid",
                    "weight": 0.3,
                    "p10": 100,
                    "p50": 300,
                    "optional": True,
                },
                {"measurement": "cls", "weight": 0.15, "p10": 0.1, "p50": 0.25, "optional": False},
                {"measurement": "ttfb", "weight": 0.1, "p10": 200, "p50": 400, "optional": False},
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Edge",
            },
        }
        assert performance_score[4] == {
            "name": "Opera",
            "scoreComponents": [
                {"measurement": "fcp", "weight": 0.15, "p10": 900, "p50": 1600, "optional": False},
                {"measurement": "lcp", "weight": 0.3, "p10": 1200, "p50": 2400, "optional": False},
                {
                    "measurement": "fid",
                    "weight": 0.3,
                    "p10": 100,
                    "p50": 300,
                    "optional": True,
                },
                {"measurement": "cls", "weight": 0.15, "p10": 0.1, "p50": 0.25, "optional": False},
                {"measurement": "ttfb", "weight": 0.1, "p10": 200, "p50": 400, "optional": False},
            ],
            "condition": {
                "op": "eq",
                "name": "event.contexts.browser.name",
                "value": "Opera",
            },
        }
