import pytest

from sentry.models import ProjectKey
from sentry.models.transaction_threshold import TransactionMetric
from sentry.relay.config import get_project_config
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


@pytest.mark.django_db
@pytest.mark.parametrize("full", [False, True], ids=["slim_config", "full_config"])
def test_get_project_config(default_project, insta_snapshot, full):
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


@pytest.mark.django_db
@pytest.mark.parametrize("has_custom_filters", [False, True])
def test_project_config_uses_filter_features(default_project, has_custom_filters):
    error_messages = ["some_error"]
    releases = ["1.2.3", "4.5.6"]
    default_project.update_option("sentry:error_messages", error_messages)
    default_project.update_option("sentry:releases", releases)

    with Feature({"projects:custom-inbound-filters": has_custom_filters}):
        cfg = get_project_config(default_project, full_config=True)

    cfg = cfg.to_dict()
    cfg_error_messages = get_path(cfg, "config", "filterSettings", "errorMessages")
    cfg_releases = get_path(cfg, "config", "filterSettings", "releases")

    if has_custom_filters:
        assert {"patterns": error_messages} == cfg_error_messages
        assert {"releases": releases} == cfg_releases
    else:
        assert cfg_releases is None
        assert cfg_error_messages is None


@pytest.mark.django_db
@pytest.mark.parametrize("has_dyn_sampling", [False, True])
@pytest.mark.parametrize("full_config", [False, True])
def test_project_config_uses_filters_and_sampling_feature(
    default_project, dyn_sampling_data, has_dyn_sampling, full_config
):
    """
    Tests that dynamic sampling information is retrieved for both "full config" and "restricted config"
    but only when the organization has "organizations:filters-and-sampling" feature enabled.
    """
    default_project.update_option("sentry:dynamic_sampling", dyn_sampling_data())

    with Feature({"organizations:filters-and-sampling": has_dyn_sampling}):
        cfg = get_project_config(default_project, full_config=full_config)

    cfg = cfg.to_dict()
    dynamic_sampling = get_path(cfg, "config", "dynamicSampling")

    if has_dyn_sampling:
        assert dynamic_sampling == dyn_sampling_data()
    else:
        assert dynamic_sampling is None


@pytest.mark.django_db
@pytest.mark.parametrize("transaction_metrics", ("with_metrics", "without_metrics"))
def test_project_config_with_breakdown(default_project, insta_snapshot, transaction_metrics):
    with Feature(
        {
            "organizations:performance-ops-breakdown": True,
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
    assert "spanAttributes" not in cfg["config"]

    with Feature("projects:performance-suspect-spans-ingestion"):
        cfg = get_project_config(default_project, full_config=True)

    cfg = cfg.to_dict()
    insta_snapshot(cfg["config"]["spanAttributes"])


@pytest.mark.django_db
@pytest.mark.parametrize("feature_flag", (False, True), ids=("feature_disabled", "feature_enabled"))
@pytest.mark.parametrize("org_sample", (0.0, 1.0), ids=("no_orgs", "all_orgs"))
@pytest.mark.parametrize(
    "killswitch", (False, True), ids=("killswitch_disabled", "killswitch_enabled")
)
def test_has_metric_extraction(default_project, feature_flag, org_sample, killswitch):
    options = override_options(
        {
            "relay.drop-transaction-metrics": [{"project_id": default_project.id}]
            if killswitch
            else [],
            "relay.transaction-metrics-org-sample-rate": org_sample,
        }
    )
    feature = Feature(
        {
            "organizations:transaction-metrics-extraction": feature_flag,
        }
    )
    with feature, options:
        config = get_project_config(default_project)
        if killswitch or (org_sample == 0.0 and not feature_flag):
            assert "transactionMetrics" not in config.to_dict()["config"]
        else:
            config = config.to_dict()["config"]["transactionMetrics"]
            assert config["extractMetrics"]
            assert config["customMeasurements"]["limit"] > 0
