from __future__ import annotations

import re
from typing import Any

import pytest
from django.urls import reverse

from sentry import quotas
from sentry.constants import ObjectStatus
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.testutils.helpers import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json, safe

_date_regex = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$")


def _get_all_keys(config):
    for key in config:
        yield key
        if key == "breakdownsV2":
            # Breakdown keys are not field names and may contain underscores,
            # e.g. span_ops
            continue
        if isinstance(config[key], dict):
            for key in _get_all_keys(config[key]):
                yield key


@pytest.fixture(autouse=True)
def setup_relay(default_project):
    default_project.update_option("sentry:scrub_ip_address", True)


@pytest.fixture
def call_endpoint(client, relay, private_key, default_projectkey):
    def inner(full_config, public_keys=None, version="2"):
        path = reverse("sentry-api-0-relay-projectconfigs") + f"?version={version}"

        if public_keys is None:
            public_keys = [str(default_projectkey.public_key)]

        if full_config is None:
            raw_json, signature = private_key.pack({"publicKeys": public_keys})
        else:
            raw_json, signature = private_key.pack(
                {"publicKeys": public_keys, "fullConfig": full_config}
            )

        resp = client.post(
            path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        return json.loads(resp.content), resp.status_code

    return inner


@pytest.fixture
def add_org_key(default_organization, relay):
    default_organization.update_option(
        "sentry:trusted-relays", [{"public_key": relay.public_key, "name": "main-relay"}]
    )


@pytest.fixture
def no_internal_networks(monkeypatch):
    """
    Disable is_internal_ip functionality (make all requests appear to be from external networks)
    """
    monkeypatch.setattr("sentry.auth.system.INTERNAL_NETWORKS", ())


@django_db_all
def test_internal_relays_should_receive_minimal_configs_if_they_do_not_explicitly_ask_for_full_config(
    call_endpoint, default_project, default_projectkey
):
    result, status_code = call_endpoint(full_config=False)

    assert status_code < 400

    # Sweeping assertion that we do not have any snake_case in that config.
    # Might need refining.
    assert not {x for x in _get_all_keys(result) if "-" in x or "_" in x}

    cfg = safe.get_path(result, "configs", str(default_projectkey.public_key))
    assert safe.get_path(cfg, "config", "filterSettings") is None
    assert safe.get_path(cfg, "config", "groupingConfig") is None


@django_db_all
def test_internal_relays_should_receive_full_configs(
    call_endpoint, default_project, default_projectkey
):
    result, status_code = call_endpoint(full_config=True)

    assert status_code < 400

    # Sweeping assertion that we do not have any snake_case in that config.
    # Might need refining.
    assert not {x for x in _get_all_keys(result) if "-" in x or "_" in x}

    cfg = safe.get_path(result, "configs", default_projectkey.public_key)
    assert safe.get_path(cfg, "disabled") is False

    (public_key,) = cfg["publicKeys"]
    assert public_key["publicKey"] == default_projectkey.public_key
    assert public_key["numericId"] == default_projectkey.id
    assert public_key["isEnabled"]

    assert safe.get_path(cfg, "slug") == default_project.slug
    last_change = safe.get_path(cfg, "lastChange")
    assert _date_regex.match(last_change) is not None
    last_fetch = safe.get_path(cfg, "lastFetch")
    assert _date_regex.match(last_fetch) is not None
    assert safe.get_path(cfg, "organizationId") == default_project.organization.id
    assert safe.get_path(cfg, "projectId") == default_project.id
    assert safe.get_path(cfg, "slug") == default_project.slug
    assert safe.get_path(cfg, "rev") is not None

    assert safe.get_path(cfg, "config", "trustedRelays") == []
    assert safe.get_path(cfg, "config", "filterSettings") is not None
    assert safe.get_path(cfg, "config", "groupingConfig", "enhancements") is not None
    assert safe.get_path(cfg, "config", "groupingConfig", "id") is not None
    assert safe.get_path(cfg, "config", "piiConfig", "applications") is None
    assert safe.get_path(cfg, "config", "piiConfig", "rules") is None
    assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubData") is True
    assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubDefaults") is True
    assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubIpAddresses") is True
    assert safe.get_path(cfg, "config", "datascrubbingSettings", "sensitiveFields") == []
    assert safe.get_path(cfg, "config", "quotas") is None
    # Event retention depends on settings, so assert the actual value.
    assert safe.get_path(cfg, "config", "eventRetention") == quotas.backend.get_event_retention(
        default_project.organization
    )


@django_db_all
def test_relays_dyamic_sampling(
    client, call_endpoint, default_project, default_projectkey, dyn_sampling_data
):
    """
    Tests that dynamic sampling configuration set in project details are retrieved in relay configs
    """
    with Feature(
        {
            "organizations:dynamic-sampling": True,
        }
    ):
        result, status_code = call_endpoint(full_config=False)
        assert status_code < 400
        dynamic_sampling = safe.get_path(
            result,
            "configs",
            str(default_projectkey.public_key),
            "config",
            "sampling",
        )
        assert dynamic_sampling == {"version": 2, "rules": []}


@django_db_all
def test_trusted_external_relays_should_not_be_able_to_request_full_configs(
    add_org_key, call_endpoint, no_internal_networks
):
    result, status_code = call_endpoint(full_config=True)
    assert status_code == 403


@django_db_all
def test_when_not_sending_full_config_info_into_a_internal_relay_a_restricted_config_is_returned(
    call_endpoint, default_project, default_projectkey
):
    result, status_code = call_endpoint(full_config=None)

    assert status_code < 400

    cfg = safe.get_path(result, "configs", str(default_projectkey.public_key))
    assert safe.get_path(cfg, "config", "filterSettings") is None
    assert safe.get_path(cfg, "config", "groupingConfig") is None


@django_db_all
def test_when_not_sending_full_config_info_into_an_external_relay_a_restricted_config_is_returned(
    call_endpoint, add_org_key, relay, default_project, default_projectkey
):
    relay.is_internal = False
    relay.save()

    result, status_code = call_endpoint(full_config=None)

    assert status_code < 400

    cfg = safe.get_path(result, "configs", str(default_projectkey.public_key))
    assert safe.get_path(cfg, "config", "filterSettings") is None
    assert safe.get_path(cfg, "config", "groupingConfig") is None


@django_db_all
def test_trusted_external_relays_should_receive_minimal_configs(
    relay, add_org_key, call_endpoint, default_project, default_projectkey
):
    relay.is_internal = False
    relay.save()

    result, status_code = call_endpoint(full_config=False)

    assert status_code < 400

    cfg = safe.get_path(result, "configs", default_projectkey.public_key)
    assert safe.get_path(cfg, "disabled") is False
    (public_key,) = cfg["publicKeys"]
    assert public_key["publicKey"] == default_projectkey.public_key
    assert public_key["numericId"] == default_projectkey.id
    assert public_key["isEnabled"]
    assert "quotas" not in public_key

    assert safe.get_path(cfg, "slug") == default_project.slug
    last_change = safe.get_path(cfg, "lastChange")
    assert _date_regex.match(last_change) is not None
    last_fetch = safe.get_path(cfg, "lastFetch")
    assert _date_regex.match(last_fetch) is not None
    assert safe.get_path(cfg, "organizationId") == default_project.organization.id
    assert safe.get_path(cfg, "projectId") == default_project.id
    assert safe.get_path(cfg, "slug") == default_project.slug
    assert safe.get_path(cfg, "rev") is not None
    assert safe.get_path(cfg, "config", "trustedRelays") == [relay.public_key]
    assert safe.get_path(cfg, "config", "filterSettings") is None
    assert safe.get_path(cfg, "config", "groupingConfig") is None
    assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubData") is not None
    assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubIpAddresses") is not None
    assert safe.get_path(cfg, "config", "piiConfig", "rules") is None
    assert safe.get_path(cfg, "config", "piiConfig", "applications") is None
    assert safe.get_path(cfg, "config", "quotas") is None


@django_db_all
def test_untrusted_external_relays_should_not_receive_configs(
    call_endpoint, default_project, default_projectkey, no_internal_networks
):
    result, status_code = call_endpoint(full_config=False)

    assert status_code < 400

    cfg = result["configs"][default_projectkey.public_key]

    assert cfg["disabled"]


@pytest.fixture
def projectconfig_cache_set(monkeypatch):
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr("sentry.relay.projectconfig_cache.backend.set_many", calls.append)
    return calls


@django_db_all
def test_relay_projectconfig_cache_minimal_config(
    call_endpoint, default_project, projectconfig_cache_set, task_runner
):
    """
    When a relay fetches a minimal config, that config should not end up in Redis.
    """

    with task_runner():
        result, status_code = call_endpoint(full_config=False)
        assert status_code < 400

    assert not projectconfig_cache_set


@django_db_all
def test_relay_projectconfig_cache_full_config(
    call_endpoint, default_projectkey, projectconfig_cache_set, task_runner
):
    """
    When a relay fetches a full config, that config should end up in Redis.
    """

    with task_runner():
        result, status_code = call_endpoint(full_config=True)
        assert status_code < 400

    http_cfg = result["configs"][default_projectkey.public_key]
    (call,) = projectconfig_cache_set
    assert len(call) == 1
    redis_cfg = call[str(default_projectkey.public_key)]

    del http_cfg["lastFetch"]
    del http_cfg["lastChange"]
    del redis_cfg["lastFetch"]
    del redis_cfg["lastChange"]

    assert redis_cfg == http_cfg


@django_db_all
def test_relay_nonexistent_project(call_endpoint, projectconfig_cache_set, task_runner):
    wrong_public_key = ProjectKey.generate_api_key()

    with task_runner():
        result, status_code = call_endpoint(full_config=True, public_keys=[wrong_public_key])
        assert status_code < 400

    assert result == {"configs": {wrong_public_key: {"disabled": True}}}

    assert projectconfig_cache_set == [{str(wrong_public_key): result["configs"][wrong_public_key]}]


@django_db_all
def test_relay_disabled_project(
    call_endpoint, default_project, projectconfig_cache_set, task_runner
):
    default_project.update(status=ObjectStatus.PENDING_DELETION)

    wrong_public_key = ProjectKey.generate_api_key()

    with task_runner():
        result, status_code = call_endpoint(full_config=True, public_keys=[wrong_public_key])
        assert status_code < 400

    assert result == {"configs": {wrong_public_key: {"disabled": True}}}

    assert projectconfig_cache_set == [{str(wrong_public_key): result["configs"][wrong_public_key]}]


@django_db_all
def test_relay_disabled_key(
    call_endpoint, default_project, projectconfig_cache_set, task_runner, default_projectkey
):
    default_projectkey.update(status=ProjectKeyStatus.INACTIVE)

    with task_runner():
        result, status_code = call_endpoint(full_config=True)
        assert status_code < 400

    (http_cfg,) = result["configs"].values()
    assert http_cfg == {"disabled": True}

    assert projectconfig_cache_set == [{str(default_projectkey.public_key): http_cfg}]


@django_db_all
@pytest.mark.parametrize("drop_sessions", [False, True])
def test_session_metrics_extraction(call_endpoint, task_runner, drop_sessions):
    with Feature({"organizations:metrics-extraction": True}), Feature(
        {"organizations:release-health-drop-sessions": drop_sessions}
    ):
        with task_runner():
            result, status_code = call_endpoint(full_config=True)
            assert status_code < 400

        for config in result["configs"].values():
            config = config["config"]
            assert config["sessionMetrics"] == {"version": 1, "drop": drop_sessions}


@django_db_all
@pytest.mark.parametrize("abnormal_mechanism_rollout", [0, 1])
def test_session_metrics_abnormal_mechanism_tag_extraction(
    call_endpoint, task_runner, set_sentry_option, abnormal_mechanism_rollout
):
    with set_sentry_option(
        "sentry-metrics.releasehealth.abnormal-mechanism-extraction-rate",
        abnormal_mechanism_rollout,
    ):
        with Feature({"organizations:metrics-extraction": True}):
            with task_runner():
                result, status_code = call_endpoint(full_config=True)
                assert status_code < 400

            for config in result["configs"].values():
                config = config["config"]
                assert config["sessionMetrics"] == {
                    "version": 2 if abnormal_mechanism_rollout else 1,
                    "drop": False,
                }
