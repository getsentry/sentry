import time
from unittest import mock
from unittest.mock import patch

import pytest
from freezegun import freeze_time

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.latest_release_booster import get_redis_client_for_ds
from sentry.dynamic_sampling.latest_release_ttas import Platform
from sentry.dynamic_sampling.rules_generator import HEALTH_CHECK_GLOBS
from sentry.dynamic_sampling.utils import RESERVED_IDS, RuleType
from sentry.models import ProjectKey
from sentry.models.transaction_threshold import TransactionMetric
from sentry.relay.config import ProjectConfig, get_project_config
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.options import override_options
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
      "hide_rule": false,
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
                "value": ["*dev*", "*test*"],
                "options": {"ignoreCase": True},
            }
        ],
    },
    "active": True,
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
    "active": True,
    "id": RESERVED_IDS[RuleType.IGNORE_HEALTHCHECKS_RULE],
}


@pytest.mark.django_db
def test_get_project_config_non_visible(default_project):
    keys = ProjectKey.objects.filter(project=default_project)
    default_project.update(status=ObjectStatus.PENDING_DELETION)
    cfg = get_project_config(default_project, full_config=True, project_keys=keys)
    assert cfg.to_dict() == {"disabled": True}


@pytest.mark.django_db
@pytest.mark.parametrize("full", [False, True], ids=["slim_config", "full_config"])
def test_get_project_config(default_project, insta_snapshot, django_cache, full):
    # We could use the default_project fixture here, but we would like to avoid 1) hitting the db 2) creating a mock
    default_project.update_option("sentry:relay_pii_config", PII_CONFIG)
    default_project.organization.update_option("sentry:relay_pii_config", PII_CONFIG)
    keys = ProjectKey.objects.filter(project=default_project)

    cfg = get_project_config(default_project, full_config=full, project_keys=keys)
    cfg = cfg.to_dict()

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


@pytest.mark.django_db
@mock.patch("sentry.relay.config.generate_rules", side_effect=SOME_EXCEPTION)
@mock.patch("sentry.relay.config.sentry_sdk")
def test_get_experimental_config_dyn_sampling(mock_sentry_sdk, _, default_project):
    keys = ProjectKey.objects.filter(project=default_project)
    with Feature({"organizations:dynamic-sampling": True}):
        # Does not raise:
        cfg = get_project_config(default_project, full_config=True, project_keys=keys)
    # Key is missing from config:
    assert "dynamicSampling" not in cfg.to_dict()["config"]
    assert mock_sentry_sdk.capture_exception.call_args == mock.call(SOME_EXCEPTION)


@pytest.mark.django_db
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

    # we check that due to exception we don't add `d:transactions/breakdowns.span_ops.ops.{op_name}@millisecond`
    assert (
        "breakdowns.span_ops.ops"
        not in cfg.to_dict()["config"]["transactionMetrics"]["extractMetrics"]
    )
    assert cfg.to_dict()["config"]["transactionMetrics"]["extractCustomTags"] == []
    assert mock_capture_exception.call_count == 2


@pytest.mark.django_db
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

    if has_blacklisted_ips:
        default_project.update_option("sentry:blacklisted_ips", blacklisted_ips)

    with Feature({"projects:custom-inbound-filters": has_custom_filters}):
        cfg = get_project_config(default_project, full_config=True)

    cfg = cfg.to_dict()
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


@pytest.mark.django_db
@mock.patch("sentry.relay.config.EXPOSABLE_FEATURES", ["projects:custom-inbound-filters"])
def test_project_config_exposed_features(default_project):
    with Feature({"projects:custom-inbound-filters": True}):
        cfg = get_project_config(default_project, full_config=True)

    cfg = cfg.to_dict()
    cfg_features = get_path(cfg, "config", "features")
    assert cfg_features == ["projects:custom-inbound-filters"]


@pytest.mark.django_db
@mock.patch("sentry.relay.config.EXPOSABLE_FEATURES", ["badprefix:custom-inbound-filters"])
def test_project_config_exposed_features_raise_exc(default_project):
    with Feature({"projects:custom-inbound-filters": True}):
        with pytest.raises(RuntimeError) as exc_info:
            get_project_config(default_project, full_config=True)
        assert (
            str(exc_info.value)
            == "EXPOSABLE_FEATURES must start with 'organizations:' or 'projects:'"
        )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "ds_basic,expected",
    [
        # dynamic-sampling: True
        # `dynamic-sampling` flag has the highest precedence
        (
            True,
            {
                "rules": [
                    DEFAULT_ENVIRONMENT_RULE,
                    DEFAULT_IGNORE_HEALTHCHECKS_RULE,
                    {
                        "sampleRate": 0.1,
                        "type": "trace",
                        "active": True,
                        "condition": {"op": "and", "inner": []},
                        "id": 1000,
                    },
                ]
            },
        ),
        (
            False,
            None,
        ),
    ],
)
def test_project_config_with_uniform_rules_based_on_plan_in_dynamic_sampling_rules(
    default_project, ds_basic, expected
):
    """
    Tests that dynamic sampling information return correct uniform rules
    """
    with Feature(
        {
            "organizations:dynamic-sampling": ds_basic,
        }
    ):
        with mock.patch(
            "sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate",
            return_value=0.1,
        ):
            cfg = get_project_config(default_project)

    cfg = cfg.to_dict()
    dynamic_sampling = get_path(cfg, "config", "dynamicSampling")
    assert dynamic_sampling == expected


@pytest.mark.django_db
@freeze_time("2022-10-21 18:50:25.000000+00:00")
def test_project_config_with_boosted_latest_releases_boost_in_dynamic_sampling_rules(
    default_project,
):
    """
    Tests that dynamic sampling information return correct uniform rules
    """
    redis_client = get_redis_client_for_ds()
    ts = time.time()

    release_ids = []
    for release_version in ("1.0", "2.0", "3.0", "4.0", "5.0", "6.0", "7.0"):
        release = Factories.create_release(
            project=default_project,
            version=release_version,
        )
        release_ids.append(release.id)

    # We mark the first release (1.0) as expired.
    time_to_adoption = Platform(default_project.platform).time_to_adoption
    boosted_releases = [[release_ids[0], ts - time_to_adoption * 2]]
    for release_id in release_ids[1:]:
        boosted_releases.append([release_id, ts])

    for release, timestamp in boosted_releases:
        redis_client.hset(
            f"ds::p:{default_project.id}:boosted_releases",
            f"ds::r:{release}:e:prod",
            timestamp,
        )
    with Feature(
        {
            "organizations:dynamic-sampling": True,
        }
    ):
        with patch(
            "sentry.dynamic_sampling.rules_generator.quotas.get_blended_sample_rate",
            return_value=0.1,
        ):
            cfg = get_project_config(default_project)

    cfg = cfg.to_dict()
    dynamic_sampling = get_path(cfg, "config", "dynamicSampling")
    assert dynamic_sampling == {
        "rules": [
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
                "sampleRate": 0.5,
                "type": "trace",
                "active": True,
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
                        {"op": "eq", "name": "trace.release", "value": ["4.0"]},
                        {
                            "op": "eq",
                            "name": "trace.environment",
                            "value": "prod",
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
                "sampleRate": 0.5,
                "type": "trace",
                "active": True,
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "eq", "name": "trace.release", "value": ["5.0"]},
                        {
                            "op": "eq",
                            "name": "trace.environment",
                            "value": "prod",
                        },
                    ],
                },
                "id": 1503,
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
                        {"op": "eq", "name": "trace.release", "value": ["6.0"]},
                        {
                            "op": "eq",
                            "name": "trace.environment",
                            "value": "prod",
                        },
                    ],
                },
                "id": 1504,
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
                        {"op": "eq", "name": "trace.release", "value": ["7.0"]},
                        {
                            "op": "eq",
                            "name": "trace.environment",
                            "value": "prod",
                        },
                    ],
                },
                "id": 1505,
                "timeRange": {
                    "start": "2022-10-21 18:50:25+00:00",
                    "end": "2022-10-21 19:50:25+00:00",
                },
            },
            {
                "sampleRate": 0.1,
                "type": "trace",
                "active": True,
                "condition": {"op": "and", "inner": []},
                "id": 1000,
            },
        ]
    }


@pytest.mark.django_db
@pytest.mark.parametrize("transaction_metrics", ("with_metrics", "without_metrics"))
def test_project_config_with_breakdown(default_project, insta_snapshot, transaction_metrics):
    with Feature(
        {
            "organizations:transaction-metrics-extraction": transaction_metrics == "with_metrics",
        }
    ):
        cfg = get_project_config(default_project, full_config=True)

    cfg = cfg.to_dict()
    insta_snapshot(
        {
            "breakdownsV2": cfg["config"]["breakdownsV2"],
            "transactionMetrics": cfg["config"].get("transactionMetrics"),
            "metricConditionalTagging": cfg["config"].get("metricConditionalTagging"),
        }
    )


@pytest.mark.django_db
@pytest.mark.parametrize("has_metrics_extraction", (True, False))
@pytest.mark.parametrize("abnormal_mechanism_rollout", (0, 1))
def test_project_config_with_organizations_metrics_extraction(
    default_project, set_sentry_option, abnormal_mechanism_rollout, has_metrics_extraction
):
    set_sentry_option(
        "sentry-metrics.releasehealth.abnormal-mechanism-extraction-rate",
        abnormal_mechanism_rollout,
    )
    with Feature({"organizations:metrics-extraction": has_metrics_extraction}):
        cfg = get_project_config(default_project, full_config=True)

    cfg = cfg.to_dict()
    session_metrics = get_path(cfg, "config", "sessionMetrics")
    if has_metrics_extraction:
        assert session_metrics == {"drop": False, "version": 2 if abnormal_mechanism_rollout else 1}
    else:
        assert session_metrics is None


@pytest.mark.django_db
@pytest.mark.parametrize("has_project_transaction_threshold", (False, True))
@pytest.mark.parametrize("has_project_transaction_threshold_overrides", (False, True))
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
        cfg = get_project_config(default_project, full_config=True)

    cfg = cfg.to_dict()
    insta_snapshot(cfg["config"]["metricConditionalTagging"])


@pytest.mark.django_db
def test_project_config_with_span_attributes(default_project, insta_snapshot):
    # The span attributes config is not set with the flag turnd off
    cfg = get_project_config(default_project, full_config=True)
    cfg = cfg.to_dict()
    insta_snapshot(cfg["config"]["spanAttributes"])


@pytest.mark.django_db
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
        config = get_project_config(default_project)
        if killswitch or not feature_flag:
            assert "transactionMetrics" not in config.to_dict()["config"]
        else:
            config = config.to_dict()["config"]["transactionMetrics"]
            assert config["extractMetrics"]
            assert config["customMeasurements"]["limit"] > 0


@pytest.mark.django_db
@pytest.mark.parametrize("org_sample", (0.0, 1.0), ids=("no_orgs", "all_orgs"))
def test_accept_transaction_names(default_project, org_sample):
    options = override_options(
        {
            "relay.transaction-names-client-based": org_sample,
        }
    )
    feature = Feature(
        {
            "organizations:transaction-metrics-extraction": True,
        }
    )
    with feature, options:
        config = get_project_config(default_project).to_dict()["config"]
        transaction_metrics_config = config["transactionMetrics"]
        assert (
            transaction_metrics_config["acceptTransactionNames"] == "clientBased"
            if org_sample
            else "strict"
        )


@pytest.mark.django_db
def test_project_config_setattr(default_project):
    project_cfg = ProjectConfig(default_project)
    with pytest.raises(Exception) as exc_info:
        project_cfg.foo = "bar"
    assert str(exc_info.value) == "Trying to change read only ProjectConfig object"


@pytest.mark.django_db
def test_project_config_getattr(default_project):
    project_cfg = ProjectConfig(default_project, foo="bar")
    assert project_cfg.foo == "bar"


@pytest.mark.django_db
def test_project_config_str(default_project):
    project_cfg = ProjectConfig(default_project, foo="bar")
    assert str(project_cfg) == '{"foo":"bar"}'

    with mock.patch.object(ProjectConfig, "to_dict") as fake_to_dict:
        fake_to_dict.side_effect = ValueError("bad data")
        project_cfg1 = ProjectConfig(default_project)
        assert str(project_cfg1) == "Content Error:bad data"


@pytest.mark.django_db
def test_project_config_repr(default_project):
    project_cfg = ProjectConfig(default_project, foo="bar")
    assert repr(project_cfg) == '(ProjectConfig){"foo":"bar"}'


@pytest.mark.django_db
def test_project_config_to_json_string(default_project):
    project_cfg = ProjectConfig(default_project, foo="bar")
    assert project_cfg.to_json_string() == '{"foo":"bar"}'


@pytest.mark.django_db
def test_project_config_get_at_path(default_project):
    project_cfg = ProjectConfig(default_project, a=1, b="The b", foo="bar")
    assert project_cfg.get_at_path("b") == "The b"
    assert project_cfg.get_at_path("bb") is None
    assert project_cfg.get_at_path("b", "c") is None
    assert project_cfg.get_at_path() == project_cfg
