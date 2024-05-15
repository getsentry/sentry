from django.urls import reverse

from sentry.testutils.cases import APITestCase


class ConfiguratioAPITestCase(APITestCase):
    endpoint = "sentry-api-0-project-configuration"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug, self.project.slug))

    def test_get_configuration(self):
        self.project.update_option(
            "sentry:remote_config",
            {
                "options": {
                    "sample_rate": 0.5,
                    "traces_sample_rate": 0,
                    "user_config": {"abc": "def"},
                },
                "version": 1,
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

        # Assert the project option was written.
        opt = self.project.get_option("sentry:remote_config")
        assert opt == {
            "options": {
                "sample_rate": 1.0,
                "traces_sample_rate": 0.2,
                "user_config": {
                    "hello": "world",
                },
            },
            "version": 1,
        }

    def test_delete_configuration(self):
        self.project.update_option("sentry:remote_config", "test")
        opt = self.project.get_option("sentry:remote_config")
        assert opt == "test"

        response = self.client.delete(self.url)
        assert response.status_code == 204

        opt = self.project.get_option("sentry:remote_config")
        assert opt is None

    def test_delete_configuration_not_found(self):
        # Eagerly delete option if one exists.
        self.project.delete_option("sentry:remote_config")

        response = self.client.delete(self.url)
        assert response.status_code == 204
