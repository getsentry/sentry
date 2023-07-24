from unittest.mock import patch
from uuid import uuid4

import pytest
from django.urls import reverse
from sentry_relay.auth import generate_key_pair

from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.relay import Relay
from sentry.relay.config import ProjectConfig
from sentry.tasks.relay import build_project_config
from sentry.testutils.hybrid_cloud import simulated_transaction_watermarks
from sentry.utils import json
from sentry.utils.pytest.fixtures import django_db_all


@pytest.fixture(autouse=True)
def disable_auto_on_commit():
    simulated_transaction_watermarks.state["default"] = -1
    with in_test_hide_transaction_boundary():
        yield


@pytest.fixture
def key_pair():
    return generate_key_pair()


@pytest.fixture
def public_key(key_pair):
    return key_pair[1]


@pytest.fixture
def private_key(key_pair):
    return key_pair[0]


@pytest.fixture
def relay_id():
    return str(uuid4())


@pytest.fixture
def relay(relay_id, public_key):
    return Relay.objects.create(relay_id=relay_id, public_key=str(public_key), is_internal=True)


@pytest.fixture
def call_global_config(client, relay, private_key, default_projectkey):
    def inner():
        path = reverse("sentry-api-0-relay-projectconfigs")

        raw_json = {"globalConfig": True}

        resp = client.post(
            path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay.relay_id,
            #     HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        return json.loads(resp.content), resp.status_code

    return inner


@pytest.fixture
def call_endpoint(client, relay, private_key, default_projectkey):
    def inner(full_config, global_config=False, public_keys=None):
        global_config = "true" if global_config else "false"
        path = reverse("sentry-api-0-relay-projectconfigs") + "?version=4"

        if public_keys is None:
            public_keys = [str(default_projectkey.public_key)]

        if full_config is None:
            raw_json, signature = private_key.pack({"publicKeys": public_keys, "no_cache": False})
        else:
            raw_json, signature = private_key.pack(
                {"publicKeys": public_keys, "fullConfig": full_config, "no_cache": False}
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
def projectconfig_cache_get_mock_config(monkeypatch):
    monkeypatch.setattr(
        "sentry.relay.projectconfig_cache.backend.get",
        lambda *args, **kwargs: {"is_mock_config": True},
    )


@pytest.fixture
def single_mock_proj_cached(monkeypatch):
    def cache_get(*args, **kwargs):
        if args[0] == "must_exist":
            return {"is_mock_config": True}
        return None

    monkeypatch.setattr("sentry.relay.projectconfig_cache.backend.get", cache_get)


@pytest.fixture
def projectconfig_debounced_cache(monkeypatch):
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.backend.is_debounced",
        lambda *args, **kargs: True,
    )


@pytest.fixture
def project_config_get_mock(monkeypatch):

    monkeypatch.setattr(
        "sentry.relay.config.get_project_config",
        lambda *args, **kwargs: ProjectConfig(
            Project(id=101, name="mock_project", organization=Organization(pk=666)),
            is_mock_config=True,
        ),
    )


@django_db_all
def test_return_global_config():
    result, status_code = call_global_config()
    assert status_code < 400
    # i'll put this in separate file ofc, this is temporary
    assert result == {
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
        },
        "metricsConditionalTagging": [
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "pageload"},
                        {"name": "event.platform", "op": "eq", "value": "javascript"},
                        {"name": "event.duration", "op": "gte", "value": 16123.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "pageload"},
                        {"name": "event.platform", "op": "eq", "value": "javascript"},
                        {"name": "event.duration", "op": "gte", "value": 7941.899538040161},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/measurements.lcp@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "pageload"},
                        {"name": "event.platform", "op": "eq", "value": "javascript"},
                        {"name": "event.duration", "op": "gte", "value": 5897.500002294778},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/measurements.fcp@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "navigation"},
                        {"name": "event.platform", "op": "eq", "value": "javascript"},
                        {"name": "event.duration", "op": "gte", "value": 4032.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "http.server"},
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 383.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "http.server"},
                        {"name": "event.platform", "op": "eq", "value": "node"},
                        {"name": "event.duration", "op": "gte", "value": 506.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "http.server"},
                        {"name": "event.platform", "op": "eq", "value": "php"},
                        {"name": "event.duration", "op": "gte", "value": 891.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "ui.load"},
                        {"name": "event.platform", "op": "eq", "value": "javascript"},
                        {"name": "event.duration", "op": "gte", "value": 199379.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "celery.task"},
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 1516.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "rails.request",
                        },
                        {"name": "event.platform", "op": "eq", "value": "ruby"},
                        {"name": "event.duration", "op": "gte", "value": 407.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "queue.task.celery",
                        },
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 2637.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "function.nextjs",
                        },
                        {"name": "event.platform", "op": "eq", "value": "node"},
                        {"name": "event.duration", "op": "gte", "value": 505.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "ui.load"},
                        {"name": "event.platform", "op": "eq", "value": "cocoa"},
                        {"name": "event.duration", "op": "gte", "value": 2387.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "http.server"},
                        {"name": "event.platform", "op": "eq", "value": "csharp"},
                        {"name": "event.duration", "op": "gte", "value": 325.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "http.server"},
                        {"name": "event.platform", "op": "eq", "value": "ruby"},
                        {"name": "event.duration", "op": "gte", "value": 347.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "ui.load"},
                        {"name": "event.platform", "op": "eq", "value": "java"},
                        {"name": "event.duration", "op": "gte", "value": 2889.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "http.server"},
                        {"name": "event.platform", "op": "eq", "value": "java"},
                        {"name": "event.duration", "op": "gte", "value": 246.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "awslambda.handler",
                        },
                        {"name": "event.platform", "op": "eq", "value": "node"},
                        {"name": "event.duration", "op": "gte", "value": 1747.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "serverless.function",
                        },
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 393.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "function.aws.lambda",
                        },
                        {"name": "event.platform", "op": "eq", "value": "node"},
                        {"name": "event.duration", "op": "gte", "value": 1633.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "default"},
                        {"name": "event.platform", "op": "eq", "value": "javascript"},
                        {"name": "event.duration", "op": "gte", "value": 3216.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "function.aws",
                        },
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 1464.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "active_job"},
                        {"name": "event.platform", "op": "eq", "value": "ruby"},
                        {"name": "event.duration", "op": "gte", "value": 1059.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "navigation"},
                        {"name": "event.platform", "op": "eq", "value": "other"},
                        {"name": "event.duration", "op": "gte", "value": 8706.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "queue.active_job",
                        },
                        {"name": "event.platform", "op": "eq", "value": "ruby"},
                        {"name": "event.duration", "op": "gte", "value": 4789.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "sidekiq"},
                        {"name": "event.platform", "op": "eq", "value": "ruby"},
                        {"name": "event.duration", "op": "gte", "value": 942.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "pageload"},
                        {"name": "event.platform", "op": "eq", "value": "other"},
                        {"name": "event.duration", "op": "gte", "value": 3000.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "pageload"},
                        {"name": "event.platform", "op": "eq", "value": "other"},
                        {"name": "event.duration", "op": "gte", "value": 4589.822045672948},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/measurements.lcp@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "pageload"},
                        {"name": "event.platform", "op": "eq", "value": "other"},
                        {"name": "event.duration", "op": "gte", "value": 3384.3555060724457},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/measurements.fcp@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "console.command",
                        },
                        {"name": "event.platform", "op": "eq", "value": "php"},
                        {"name": "event.duration", "op": "gte", "value": 1485.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "queue.sidekiq",
                        },
                        {"name": "event.platform", "op": "eq", "value": "ruby"},
                        {"name": "event.duration", "op": "gte", "value": 2262.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "transaction"},
                        {"name": "event.platform", "op": "eq", "value": "node"},
                        {"name": "event.duration", "op": "gte", "value": 333.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "ui.action"},
                        {"name": "event.platform", "op": "eq", "value": "cocoa"},
                        {"name": "event.duration", "op": "gte", "value": 10400.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "default"},
                        {"name": "event.platform", "op": "eq", "value": "node"},
                        {"name": "event.duration", "op": "gte", "value": 1686.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "ui.action.click",
                        },
                        {"name": "event.platform", "op": "eq", "value": "cocoa"},
                        {"name": "event.duration", "op": "gte", "value": 14519.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "asgi.server"},
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 4690.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "http.server"},
                        {"name": "event.platform", "op": "eq", "value": "go"},
                        {"name": "event.duration", "op": "gte", "value": 16.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "sentry.test"},
                        {"name": "event.platform", "op": "eq", "value": "php"},
                        {"name": "event.duration", "op": "gte", "value": 4.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "websocket.server",
                        },
                        {"name": "event.platform", "op": "eq", "value": "ruby"},
                        {"name": "event.duration", "op": "gte", "value": 16.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "ui.action.click",
                        },
                        {"name": "event.platform", "op": "eq", "value": "java"},
                        {"name": "event.duration", "op": "gte", "value": 13211.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "http.server"},
                        {"name": "event.platform", "op": "eq", "value": "other"},
                        {"name": "event.duration", "op": "gte", "value": 228.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "test"},
                        {"name": "event.platform", "op": "eq", "value": "node"},
                        {"name": "event.duration", "op": "gte", "value": 4284.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "gql"},
                        {"name": "event.platform", "op": "eq", "value": "node"},
                        {"name": "event.duration", "op": "gte", "value": 492.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "default"},
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 253.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "rails.action_cable",
                        },
                        {"name": "event.platform", "op": "eq", "value": "ruby"},
                        {"name": "event.duration", "op": "gte", "value": 20.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "queue.process",
                        },
                        {"name": "event.platform", "op": "eq", "value": "php"},
                        {"name": "event.duration", "op": "gte", "value": 850.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "websocket.server",
                        },
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 24901.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "rq.task"},
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 1435.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "task"},
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 1317.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "ui.action.swipe",
                        },
                        {"name": "event.platform", "op": "eq", "value": "java"},
                        {"name": "event.duration", "op": "gte", "value": 18818.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "queue.task.rq",
                        },
                        {"name": "event.platform", "op": "eq", "value": "python"},
                        {"name": "event.duration", "op": "gte", "value": 3313.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {"name": "event.contexts.trace.op", "op": "eq", "value": "navigation"},
                        {"name": "event.platform", "op": "eq", "value": "java"},
                        {"name": "event.duration", "op": "gte", "value": 9647.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [
                        {
                            "name": "event.contexts.trace.op",
                            "op": "eq",
                            "value": "ui.action.scroll",
                        },
                        {"name": "event.platform", "op": "eq", "value": "java"},
                        {"name": "event.duration", "op": "gte", "value": 7432.0},
                    ],
                    "op": "and",
                },
                "tagValue": "outlier",
                "targetMetrics": ["d:transactions/duration@millisecond"],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {
                    "inner": [{"name": "event.duration", "op": "gte", "value": 0}],
                    "op": "and",
                },
                "tagValue": "inlier",
                "targetMetrics": [
                    "d:transactions/duration@millisecond",
                    "d:transactions/measurements.lcp@millisecond",
                    "d:transactions/measurements.fcp@millisecond",
                ],
                "targetTag": "histogram_outlier",
            },
            {
                "condition": {"inner": [], "op": "and"},
                "tagValue": "outlier",
                "targetMetrics": [
                    "d:transactions/duration@millisecond",
                    "d:transactions/measurements.lcp@millisecond",
                    "d:transactions/measurements.fcp@millisecond",
                ],
                "targetTag": "histogram_outlier",
            },
        ],
    }


@django_db_all
def test_return_full_config_if_in_cache(
    call_endpoint, default_projectkey, projectconfig_cache_get_mock_config
):
    result, status_code = call_endpoint(full_config=True)
    assert status_code < 400
    assert result == {
        "configs": {default_projectkey.public_key: {"is_mock_config": True}},
        "pending": [],
    }


@django_db_all
def test_return_partial_config_if_in_cache(
    monkeypatch,
    call_endpoint,
    default_projectkey,
    default_project,
    projectconfig_cache_get_mock_config,
):
    # Partial configs are handled as ``v2``, even if the param is ``v3``
    monkeypatch.setattr(
        "sentry.relay.config.get_project_config",
        lambda *args, **kwargs: ProjectConfig(default_project, is_mock_config=True),
    )

    result, status_code = call_endpoint(full_config=False)
    assert status_code < 400
    expected = {
        "configs": {default_projectkey.public_key: {"is_mock_config": True}},
        "pending": [],
    }
    assert result == expected


@django_db_all
def test_proj_in_cache_and_another_pending(
    call_endpoint, default_projectkey, single_mock_proj_cached
):
    result, status_code = call_endpoint(
        full_config=True, public_keys=["must_exist", default_projectkey.public_key]
    )
    assert status_code < 400
    assert result == {
        "configs": {"must_exist": {"is_mock_config": True}},
        "pending": [default_projectkey.public_key],
    }


@patch("sentry.tasks.relay.build_project_config.delay")
@django_db_all
def test_enqueue_task_if_config_not_cached_not_queued(
    schedule_mock,
    call_endpoint,
    default_projectkey,
):
    result, status_code = call_endpoint(full_config=True)
    assert status_code < 400
    assert result == {"configs": {}, "pending": [default_projectkey.public_key]}
    assert schedule_mock.call_count == 1


@patch("sentry.tasks.relay.build_project_config.delay")
@django_db_all
def test_debounce_task_if_proj_config_not_cached_already_enqueued(
    task_mock,
    call_endpoint,
    default_projectkey,
    projectconfig_debounced_cache,
):
    result, status_code = call_endpoint(full_config=True)
    assert status_code < 400
    assert result == {"configs": {}, "pending": [default_projectkey.public_key]}
    assert task_mock.call_count == 0


@patch("sentry.relay.projectconfig_cache.backend.set_many")
@django_db_all
def test_task_writes_config_into_cache(
    cache_set_many_mock,
    default_projectkey,
    project_config_get_mock,
):
    build_project_config(
        public_key=default_projectkey.public_key,
        update_reason="test",
    )

    assert cache_set_many_mock.call_count == 1
    # Using a tuple because that's the format `.args` uses
    assert cache_set_many_mock.call_args.args == (
        {default_projectkey.public_key: {"is_mock_config": True}},
    )
