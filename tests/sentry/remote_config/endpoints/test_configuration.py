from typing import Any

from django.urls import reverse

from sentry.remote_config.storage import StorageBackend
from sentry.testutils.cases import APITestCase

REMOTE_CONFIG_FEATURES = {"organizations:remote-config": True}


class ConfiguratioAPITestCase(APITestCase):
    endpoint = "sentry-api-0-project-key-configuration"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            self.endpoint,
            args=(self.organization.slug, self.project.slug, self.projectkey.public_key),
        )

    @property
    def storage(self):
        return StorageBackend(self.projectkey)

    def test_get_configuration(self):
        self.storage.set(
            {
                "id": self.projectkey.public_key,
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            },
        )

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.json() == {
            "data": {
                "id": self.projectkey.public_key,
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            }
        }

    def test_get_configuration_not_enabled(self):
        self.storage.set(
            {
                "id": self.projectkey.public_key,
                "features": [{"key": "abc", "value": "def"}],
                "options": {"sample_rate": 0.5, "traces_sample_rate": 0},
            },
        )
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_get_configuration_not_found(self):
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
                "id": self.projectkey.public_key,
                "features": [{"key": "hello", "value": "world"}],
                "options": {"sample_rate": 1.0, "traces_sample_rate": 0.2},
            }
        }

        # Assert the configuration was stored successfully.
        assert self.storage.get() == response.json()["data"]

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
                "id": self.projectkey.public_key,
                "features": [],
                "options": {"sample_rate": 1.0, "traces_sample_rate": 1.0},
            }
        )
        assert self.storage.get() is not None

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.delete(self.url)
        assert response.status_code == 204
        assert self.storage.get() is None

    def test_delete_configuration_not_found(self):
        # Eagerly delete option if one exists.
        self.storage.pop()

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.delete(self.url)
        assert response.status_code == 204

    def test_delete_configuration_not_enabled(self):
        response = self.client.delete(self.url)
        assert response.status_code == 404
