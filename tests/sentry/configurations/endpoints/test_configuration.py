from django.urls import reverse

from sentry.configurations.storage import StorageBackend
from sentry.testutils.cases import APITestCase


class ConfiguratioAPITestCase(APITestCase):
    endpoint = "sentry-api-0-project-configuration"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug, self.project.slug))

    @property
    def storage(self):
        return StorageBackend(self.project)

    def test_get_configuration(self):
        self.storage.set(
            {
                "id": 1,
                "sample_rate": 0.5,
                "traces_sample_rate": 0,
                "user_config": {"abc": "def"},
            },
        )

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.json() == {
            "data": {
                "id": self.project.id,
                "sample_rate": 0.5,
                "traces_sample_rate": 0,
                "user_config": {"abc": "def"},
            }
        }

    def test_get_configuration_not_found(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_post_configuration(self):
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
                "id": self.project.id,
                "sample_rate": 1.0,
                "traces_sample_rate": 0.2,
                "user_config": {
                    "hello": "world",
                },
            }
        }

        # Assert the configuration was stored successfully.
        assert self.storage.get() == response.json()["data"]

    def test_post_configuration_validation_error(self):
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
            {"id": 1, "sample_rate": 1.0, "traces_sample_rate": 1.0, "user_config": None}
        )
        assert self.storage.get() is not None

        response = self.client.delete(self.url)
        assert response.status_code == 204
        assert self.storage.get() is None

    def test_delete_configuration_not_found(self):
        # Eagerly delete option if one exists.
        self.storage.pop()

        response = self.client.delete(self.url)
        assert response.status_code == 204
