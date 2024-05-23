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
                "sample_rate": 0.5,
                "traces_sample_rate": 0,
                "user_config": {"abc": "def"},
            },
        )

        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.json() == {
            "data": {
                "id": self.projectkey.public_key,
                "sample_rate": 0.5,
                "traces_sample_rate": 0,
                "user_config": {"abc": "def"},
            }
        }

    def test_get_configuration_not_enabled(self):
        self.storage.set(
            {
                "id": self.projectkey.public_key,
                "sample_rate": 0.5,
                "traces_sample_rate": 0,
                "user_config": {"abc": "def"},
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
                        "sample_rate": 1.0,
                        "traces_sample_rate": 0.2,
                        "user_config": {
                            "hello": "world",
                        },
                    }
                },
                format="json",
            )

        assert response.status_code == 201, response.content
        assert response.json() == {
            "data": {
                "id": self.projectkey.public_key,
                "sample_rate": 1.0,
                "traces_sample_rate": 0.2,
                "user_config": {
                    "hello": "world",
                },
            }
        }

        # Assert the configuration was stored successfully.
        assert self.storage.get() == response.json()["data"]

    def test_post_configuration_not_enabled(self):
        response = self.client.post(self.url, data={}, format="json")
        assert response.status_code == 404

    def test_post_configuration_different_types(self):
        data: dict[str, Any] = {"data": {"sample_rate": 1.0, "traces_sample_rate": 0.2}}

        # Null type
        data["data"]["user_config"] = None
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["user_config"] is None

        # Bool types
        data["data"]["user_config"] = False
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["user_config"] is False

        # String types
        data["data"]["user_config"] = "string"
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["user_config"] == "string"

        # Integer types
        data["data"]["user_config"] = 1
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["user_config"] == 1

        # Float types
        data["data"]["user_config"] = 1.0
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["user_config"] == 1.0

        # Array types
        data["data"]["user_config"] = ["a", "b"]
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["user_config"] == ["a", "b"]

        # Object types
        data["data"]["user_config"] = {"hello": "world"}
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
        assert response.json()["data"]["user_config"] == {"hello": "world"}

    def test_post_configuration_validation_error(self):
        with self.feature(REMOTE_CONFIG_FEATURES):
            response = self.client.post(
                self.url,
                data={"data": {}},
                format="json",
            )
        assert response.status_code == 400, response.content

        result = response.json()
        assert len(result["data"]) == 3
        assert result["data"]["sample_rate"] is not None
        assert result["data"]["traces_sample_rate"] is not None
        assert result["data"]["user_config"] is not None

    def test_delete_configuration(self):
        self.storage.set(
            {
                "id": self.projectkey.public_key,
                "sample_rate": 1.0,
                "traces_sample_rate": 1.0,
                "user_config": None,
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
