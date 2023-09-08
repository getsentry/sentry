from unittest.mock import patch

import pytest
from django.urls import reverse

from sentry.relay.globalconfig import get_global_config
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


@pytest.fixture
def call_endpoint(client, relay, private_key):
    def inner(version, global_):
        path = reverse("sentry-api-0-relay-projectconfigs") + "?version=3"

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
    assert get_global_config() == {
        "measurements": {
            "builtinMeasurements": [
                {"name": "app_start_cold", "unit": "millisecond"},
                {"name": "app_start_warm", "unit": "millisecond"},
                {"name": "cls", "unit": "none"},
                {"name": "fcp", "unit": "millisecond"},
                {"name": "fid", "unit": "millisecond"},
                {"name": "fp", "unit": "millisecond"},
                {"name": "frames_frozen_rate", "unit": "ratio"},
                {"name": "frames_frozen", "unit": "none"},
                {"name": "frames_slow_rate", "unit": "ratio"},
                {"name": "frames_slow", "unit": "none"},
                {"name": "frames_total", "unit": "none"},
                {"name": "inp", "unit": "millisecond"},
                {"name": "lcp", "unit": "millisecond"},
                {"name": "stall_count", "unit": "none"},
                {"name": "stall_longest_time", "unit": "millisecond"},
                {"name": "stall_percentage", "unit": "ratio"},
                {"name": "stall_total_time", "unit": "millisecond"},
                {"name": "ttfb.requesttime", "unit": "millisecond"},
                {"name": "ttfb", "unit": "millisecond"},
                {"name": "time_to_full_display", "unit": "millisecond"},
                {"name": "time_to_initial_display", "unit": "millisecond"},
            ],
            "maxCustomMeasurements": 10,
        }
    }


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
