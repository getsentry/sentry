from __future__ import annotations

import re
from typing import Any
from unittest.mock import patch

import orjson
import pytest
from django.urls import reverse

from sentry import quotas
from sentry.constants import ObjectStatus
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.testutils.helpers import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import safe
from tests.sentry.api.endpoints.test_relay_projectconfigs import assert_no_snakecase_key

_date_regex = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$")


@pytest.fixture(autouse=True)
def setup_relay(default_project):
    default_project.update_option("sentry:scrub_ip_address", True)


@pytest.fixture
def call_endpoint(client, relay, private_key, default_projectkey):
    def inner(public_keys=None):
        path = reverse("sentry-api-0-relay-projectconfigs") + "?version=2"

        if public_keys is None:
            public_keys = [str(default_projectkey.public_key)]

        raw_json, signature = private_key.pack({"publicKeys": public_keys})

        resp = client.post(
            path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        return orjson.loads(resp.content), resp.status_code

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
def test_internal_relays_should_receive_full_configs(
    call_endpoint, default_project, default_projectkey
):
    result, status_code = call_endpoint()

    assert status_code < 400

    assert_no_snakecase_key(result)

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
def test_relays_dyamic_sampling(call_endpoint, default_projectkey):
    """
    Tests that dynamic sampling configuration set in project details are retrieved in relay configs
    """
    with Feature(
        {
            "organizations:dynamic-sampling": True,
        }
    ):
        result, status_code = call_endpoint()
        assert status_code < 400
        dynamic_sampling = safe.get_path(
            result,
            "configs",
            str(default_projectkey.public_key),
            "config",
            "sampling",
        )
        assert dynamic_sampling == {
            "version": 2,
            "rules": [
                {
                    "samplingValue": {"type": "sampleRate", "value": 1.0},
                    "type": "trace",
                    "condition": {"op": "and", "inner": []},
                    "id": 1000,  # this is reserved id for RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE which is being created
                }
            ],
        }


@django_db_all
def test_trusted_external_relays_should_not_be_able_to_request_full_configs(
    add_org_key, call_endpoint, no_internal_networks
):
    result, status_code = call_endpoint()
    assert status_code == 403


@django_db_all
@patch("sentry.api.authentication.is_internal_relay")
def test_external_relays_do_not_get_project_configuration(
    is_internal_relay, call_endpoint, add_org_key, relay
):
    is_internal_relay.return_value = False

    result, status_code = call_endpoint()
    assert status_code == 403


@django_db_all
def test_untrusted_external_relays_should_not_receive_configs(call_endpoint, no_internal_networks):
    result, status_code = call_endpoint()

    assert status_code == 403


@pytest.fixture
def projectconfig_cache_set(monkeypatch):
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr("sentry.relay.projectconfig_cache.backend.set_many", calls.append)
    return calls


@django_db_all
def test_relay_projectconfig_cache_full_config(
    call_endpoint, default_projectkey, projectconfig_cache_set, task_runner
):
    """
    When a relay fetches a full config, that config should end up in Redis.
    """

    with task_runner():
        result, status_code = call_endpoint()
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
        result, status_code = call_endpoint(public_keys=[wrong_public_key])
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
        result, status_code = call_endpoint(public_keys=[wrong_public_key])
        assert status_code < 400

    assert result == {"configs": {wrong_public_key: {"disabled": True}}}

    assert projectconfig_cache_set == [{str(wrong_public_key): result["configs"][wrong_public_key]}]


@django_db_all
def test_relay_disabled_key(
    call_endpoint, projectconfig_cache_set, task_runner, default_projectkey
):
    default_projectkey.update(status=ProjectKeyStatus.INACTIVE)

    with task_runner():
        result, status_code = call_endpoint()
        assert status_code < 400

    (http_cfg,) = result["configs"].values()
    assert http_cfg == {"disabled": True}

    assert projectconfig_cache_set == [{str(default_projectkey.public_key): http_cfg}]


@django_db_all
def test_session_metrics_extraction(call_endpoint, task_runner):
    with task_runner():
        result, status_code = call_endpoint()
        assert status_code < 400

    for config in result["configs"].values():
        config = config["config"]
        assert config["sessionMetrics"] == {"version": 1}


@django_db_all
@pytest.mark.parametrize("abnormal_mechanism_rollout", [0, 1])
def test_session_metrics_abnormal_mechanism_tag_extraction(
    call_endpoint, task_runner, set_sentry_option, abnormal_mechanism_rollout
):
    with set_sentry_option(
        "sentry-metrics.releasehealth.abnormal-mechanism-extraction-rate",
        abnormal_mechanism_rollout,
    ):
        with task_runner():
            result, status_code = call_endpoint()
            assert status_code < 400

        for config in result["configs"].values():
            config = config["config"]
            assert config["sessionMetrics"] == {
                "version": 2 if abnormal_mechanism_rollout else 1,
            }
