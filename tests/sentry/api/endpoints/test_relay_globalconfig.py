import pytest
from django.urls import reverse

from sentry.relay.config.measurements import BUILTIN_MEASUREMENTS
from sentry.relay.config.metric_extraction import HISTOGRAM_OUTLIER_RULES
from sentry.utils import json
from sentry.utils.pytest.fixtures import django_db_all
from tests.sentry.api.endpoints.conftest import private_key, relay


@pytest.fixture
def call_global_config():
    def inner(client):
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
        "global": {
            "measurements": BUILTIN_MEASUREMENTS,
            "metricsConditionalTagging": HISTOGRAM_OUTLIER_RULES,
        }
    }
