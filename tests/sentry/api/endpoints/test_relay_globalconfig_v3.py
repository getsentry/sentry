from unittest.mock import patch

import orjson
import pytest
from django.urls import reverse
from sentry_relay.processing import normalize_global_config

from sentry.relay.globalconfig import get_global_config
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def call_endpoint(client, relay, private_key):
    def inner(version, global_):
        path = reverse("sentry-api-0-relay-projectconfigs") + f"?version={version}"

        body = {"global": True} if global_ else {}
        raw_json, signature = private_key.pack(body)

        resp = client.post(
            path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        return orjson.loads(resp.content), resp.status_code

    return inner


@pytest.mark.django_db
@override_options(
    {
        # Set options to Relay's non-default values to avoid Relay skipping deserialization
        "relay.cardinality-limiter.error-sample-rate": 1.0,
        "profiling.profile_metrics.unsampled_profiles.enabled": True,
        "profiling.profile_metrics.unsampled_profiles.platforms": ["fake-platform"],
        "profiling.profile_metrics.unsampled_profiles.sample_rate": 1.0,
        "relay.span-usage-metric": True,
        "relay.cardinality-limiter.mode": "passive",
        "replay.relay-snuba-publishing-disabled.sample-rate": 1.0,
        "relay.kafka.span-v2.sample-rate": 1.0,
        "relay.metric-bucket-distribution-encodings": {
            "custom": "array",
            "profiles": "array",
            "spans": "array",
            "transactions": "array",
        },
        "relay.metric-bucket-set-encodings": {
            "custom": "base64",
            "profiles": "base64",
            "spans": "base64",
            "transactions": "base64",
        },
    }
)
def test_global_config() -> None:
    config = get_global_config()

    normalized = normalize_global_config(config)

    # It is not allowed to specify `None` as default for an option.
    if not config["options"]["relay.span-normalization.allowed_hosts"]:
        del config["options"]["relay.span-normalization.allowed_hosts"]

    assert normalized == config


@patch(
    "sentry.api.endpoints.relay.project_configs.get_global_config",
    lambda *args, **kargs: {"global_mock_config": True},
)
@pytest.mark.parametrize(
    ("version, request_global_config, expect_global_config"),
    [
        *((version, False, False) for version in (1, 2)),
        *((version, True, False) for version in (1, 2)),
        *((version, False, False) for version in (3,)),
        *((version, True, True) for version in (3,)),
    ],
)
@django_db_all
def test_return_global_config_on_right_version(
    call_endpoint,
    version,
    request_global_config,
    expect_global_config,
):
    result, status_code = call_endpoint(version, request_global_config)
    assert status_code < 400
    if not expect_global_config:
        assert "global" not in result
    else:
        assert result.get("global") == {"global_mock_config": True}


@patch(
    "sentry.relay.globalconfig.get_global_generic_filters",
    lambda *args, **kwargs: {
        "version": 1,
        "filters": [
            {
                "id": "test-id",
                "isEnabled": True,
                "condition": {
                    "op": "not",
                    "inner": {
                        "op": "eq",
                        "name": "event.contexts.browser.name",
                        "value": "Firefox",
                    },
                },
            }
        ],
    },
)
@patch("sentry.relay.globalconfig.RELAY_OPTIONS", [])
@django_db_all
def test_global_config_valid_with_generic_filters() -> None:
    config = get_global_config()
    assert config == normalize_global_config(config)


@django_db_all
def test_global_config_histogram_outliers(insta_snapshot) -> None:
    config = get_global_config()
    insta_snapshot(config["metricExtraction"])


@django_db_all
def test_global_config_ai_operation_type_map() -> None:
    config = get_global_config()

    assert "aiOperationTypeMap" in config
    ai_operation_type_map = config["aiOperationTypeMap"]

    assert ai_operation_type_map["version"] == 1

    expected_mappings = {
        "ai.run.generateText": "agent",
        "ai.run.generateObject": "agent",
        "gen_ai.invoke_agent": "agent",
        "ai.pipeline.generate_text": "agent",
        "ai.pipeline.generate_object": "agent",
        "ai.pipeline.stream_text": "agent",
        "ai.pipeline.stream_object": "agent",
        "gen_ai.create_agent": "agent",
        "gen_ai.execute_tool": "tool",
        "gen_ai.handoff": "handoff",
        "invoke_agent": "agent",
        "create_agent": "agent",
        "execute_tool": "tool",
        "handoff": "handoff",
    }

    operation_types = ai_operation_type_map["operationTypes"]
    for operation, expected_type in expected_mappings.items():
        assert operation in operation_types
        assert operation_types[operation] == expected_type

    # verify the wildcard mapping for ai_client
    assert "*" in operation_types
    assert operation_types["*"] == "ai_client"
