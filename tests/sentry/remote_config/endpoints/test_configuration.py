from typing import Any
from uuid import uuid4

from django.urls import reverse
from sentry_relay.auth import generate_key_pair

from sentry.models.relay import Relay
from sentry.remote_config.storage import make_api_backend
from sentry.testutils.cases import APITestCase

REMOTE_CONFIG_FEATURES = {"organizations:remote-config": True}


class ConfigurationAPITestCase(APITestCase):
    endpoint = "sentry-api-0-project-key-configuration"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug, self.project.slug))

    @property
    def storage(self):
        return make_api_backend(self.project)

    def test_get_configuration(self):
        self.storage.set(
            {
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            },
        )

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response["X-Sentry-Data-Source"] == "cache"
        assert response.json() == {
            "data": {
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            }
        }

    def test_get_configuration_no_cache(self):
        self.storage.set(
            {
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            },
        )
        self.storage.driver.cache.pop()

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response["X-Sentry-Data-Source"] == "store"
        assert response.json() == {
            "data": {
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            }
        }
        assert self.storage.driver.cache.get() is not None

    def test_get_configuration_not_enabled(self):
        self.storage.set(
            {
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            },
        )
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_get_configuration_not_found(self):
        self.storage.pop()  # Pop anything that might be in the cache.
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 404

    def test_post_configuration(self):
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(
                self.url,
                data={
                    "data": {
                        "features": [{"key": "hello", "value": "world"}],
                        "options": {"sample_rate": 1.0, "traces_sample_rate": 0.2},
                    }
                },
                format="json",
            )

        assert response.status_code == 201, response.content
        assert response.json() == {
            "data": {
                "features": [{"key": "hello", "value": "world"}],
                "options": {"sample_rate": 1.0, "traces_sample_rate": 0.2},
            }
        }

        # Assert the configuration was stored successfully.
        assert self.storage.get()[0] == response.json()["data"]

    def test_post_configuration_not_enabled(self):
        response = self.client.post(self.url, data={}, format="json")
        assert response.status_code == 404

    def test_post_configuration_different_types(self):
        data: dict[str, Any] = {
            "data": {"options": {"sample_rate": 1.0, "traces_sample_rate": 0.2}}
        }

        # Null type
        data["data"]["features"] = [{"key": "abc", "value": None}]
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["features"][0]["value"] is None

        # Bool types
        data["data"]["features"] = [{"key": "abc", "value": False}]
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["features"][0]["value"] is False

        # String types
        data["data"]["features"] = [{"key": "abc", "value": "string"}]
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["features"][0]["value"] == "string"

        # Integer types
        data["data"]["features"] = [{"key": "abc", "value": 1}]
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["features"][0]["value"] == 1

        # Float types
        data["data"]["features"] = [{"key": "abc", "value": 1.0}]
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["features"][0]["value"] == 1.0

        # Array types
        data["data"]["features"] = [{"key": "abc", "value": ["a", "b"]}]
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["features"][0]["value"] == ["a", "b"]

        # Object types
        data["data"]["features"] = [{"key": "abc", "value": {"hello": "world"}}]
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["features"][0]["value"] == {"hello": "world"}

    def test_post_configuration_required_fields(self):
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(
                self.url,
                data={"data": {}},
                format="json",
            )
        assert response.status_code == 400, response.content

        result = response.json()
        assert len(result["data"]) == 2
        assert result["data"]["options"] is not None
        assert result["data"]["features"] is not None

    def test_delete_configuration(self):
        self.storage.set(
            {
                "features": [],
                "options": {"sample_rate": 1.0, "traces_sample_rate": 1.0},
            }
        )
        assert self.storage.get()[0] is not None

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.delete(self.url)
        assert response.status_code == 204
        assert self.storage.get()[0] is None

    def test_delete_configuration_no_cache(self):
        self.storage.set(
            {
                "features": [],
                "options": {"sample_rate": 1.0, "traces_sample_rate": 1.0},
            }
        )
        assert self.storage.get()[0] is not None
        self.storage.driver.cache.pop()

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.delete(self.url)
        assert response.status_code == 204
        assert self.storage.get()[0] is None
        assert self.storage.driver.cache.get() is None

    def test_delete_configuration_not_found(self):
        self.storage.pop()
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.delete(self.url)
        assert response.status_code == 204

    def test_delete_configuration_not_enabled(self):
        response = self.client.delete(self.url)
        assert response.status_code == 404


class ConfigurationProxyAPITestCase(APITestCase):
    endpoint = "sentry-api-0-project-remote-configuration"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.endpoint, args=(self.project.id,))

    @property
    def storage(self):
        return make_api_backend(self.project)

    def test_remote_config_proxy(self):
        """Assert configurations are returned successfully."""
        self.storage.set(
            {
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            },
        )

        keys = generate_key_pair()
        relay = Relay.objects.create(
            relay_id=str(uuid4()), public_key=str(keys[1]), is_internal=True
        )

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.get(
                self.url, content_type="application/json", HTTP_X_SENTRY_RELAY_ID=relay.relay_id
            )
            assert response.status_code == 200
            assert response["ETag"] is not None
            assert response["Cache-Control"] == "public, max-age=3600"
            assert response["Content-Type"] == "application/json"
            assert response["X-Sentry-Data-Source"] == "cache"

    def test_remote_config_proxy_not_cached(self):
        """Assert configurations are returned successfully."""
        self.storage.set(
            {
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            },
        )
        self.storage.driver.cache.pop()

        keys = generate_key_pair()
        relay = Relay.objects.create(
            relay_id=str(uuid4()), public_key=str(keys[1]), is_internal=True
        )

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.get(
                self.url, content_type="application/json", HTTP_X_SENTRY_RELAY_ID=relay.relay_id
            )
            assert response.status_code == 200
            assert response["ETag"] is not None
            assert response["Cache-Control"] == "public, max-age=3600"
            assert response["Content-Type"] == "application/json"
            assert response["X-Sentry-Data-Source"] == "store"

    def test_remote_config_proxy_not_found(self):
        """Assert missing configurations 404."""
        self.storage.pop()

        keys = generate_key_pair()
        relay = Relay.objects.create(
            relay_id=str(uuid4()), public_key=str(keys[1]), is_internal=True
        )

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.get(
                self.url, content_type="application/json", HTTP_X_SENTRY_RELAY_ID=relay.relay_id
            )
            assert response.status_code == 404

    def test_remote_config_proxy_feature_disabled(self):
        """Assert access is gated by feature flag."""
        self.storage.pop()

        keys = generate_key_pair()
        relay = Relay.objects.create(
            relay_id=str(uuid4()), public_key=str(keys[1]), is_internal=True
        )

        response = self.client.get(
            self.url, content_type="application/json", HTTP_X_SENTRY_RELAY_ID=relay.relay_id
        )
        assert response.status_code == 404
