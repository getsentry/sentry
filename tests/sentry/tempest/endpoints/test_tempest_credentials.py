from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import Feature


class TestTempestCredentials(APITestCase):
    endpoint = "sentry-api-0-project-tempest-credentials"

    def test_create_tempest_credentials(self):
        with Feature({"organizations:tempest-access": True}):
            credentials = [self.create_tempest_credentials(self.project) for _ in range(5)]

            other_project = self.create_project(organization=self.organization)
            # credentials connected to other project which should not be included in the response
            for _ in range(5):
                self.create_tempest_credentials(other_project)

            self.login_as(self.user)
            response = self.get_success_response(self.project.organization.slug, self.project.slug)

            assert len(response.data) == 5
            assert {cred.id for cred in credentials} == {item["id"] for item in response.data}

    def test_endpoint_returns_404_if_feature_flag_is_disabled(self):
        self.login_as(self.user)
        response = self.get_response(self.project.organization.slug, self.project.slug)
        assert response.status_code == 404

    def test_client_secret_is_obfuscated(self):
        with Feature({"organizations:tempest-access": True}):
            credentials = self.create_tempest_credentials(self.project)
            self.login_as(self.user)
            response = self.get_success_response(self.project.organization.slug, self.project.slug)
            assert response.data[0]["clientSecret"] == "*" * len(credentials.client_secret)

    def test_unauthenticated_user_cant_access_endpoint(self):
        self.get_error_response(self.project.organization.slug, self.project.slug)
