from unittest.mock import patch

import pytest
from django.urls import reverse
from sentry_relay.processing import normalize_global_config

from sentry.relay.globalconfig import get_global_config
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


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

        return json.loads(resp.content), resp.status_code

    return inner


def test_global_config():
    config = get_global_config()
    normalized = normalize_global_config(config)
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
