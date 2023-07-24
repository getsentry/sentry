from uuid import uuid4

import pytest
from django.urls import reverse
from sentry_relay.auth import generate_key_pair

from sentry.models.relay import Relay
from sentry.utils import json
from sentry.utils.pytest.fixtures import django_db_all


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
def call_global_config(client, relay, private_key):
    def inner():
        path = reverse("sentry-api-0-relay-projectconfigs")

        raw_json, signature = private_key.pack({"globalConfig": True})

        resp = client.post(
            path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        return json.loads(resp.content), resp.status_code

    return inner


@django_db_all
def test_return_global_config(call_global_config):
    result, status_code = call_global_config()
    assert status_code < 400
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
