from django.urls import reverse

from ..api import APITestCase


class IntegrationRepositoryTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def add_create_repository_responses(self, repository_config):
        raise NotImplementedError

    def create_repository(
        self, repository_config, integration_id, organization_slug=None, add_responses=True
    ):
        if add_responses:
            self.add_create_repository_responses(repository_config)
        if not integration_id:
            data = {"provider": self.provider_name, "identifier": repository_config["id"]}
        else:
            data = {
                "provider": self.provider_name,
                "installation": integration_id,
                "identifier": repository_config["id"],
            }

        response = self.client.post(
            path=reverse(
                "sentry-api-0-organization-repositories",
                args=[organization_slug or self.organization.slug],
            ),
            data=data,
        )
        return response

    def assert_error_message(self, response, error_type, error_message):
        assert response.data["error_type"] == error_type
        assert error_message in response.data["errors"]["__all__"]
