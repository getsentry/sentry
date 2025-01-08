from unittest.mock import patch

from sentry.tempest.models import TempestCredentials
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import Feature


class TestTempestCredentials(APITestCase):
    endpoint = "sentry-api-0-project-tempest-credentials"

    valid_credentials_data = {"clientId": "test", "clientSecret": "test"}

    def test_get_tempest_credentials(self):
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

    @patch(
        "sentry.tempest.endpoints.tempest_credentials.TempestCredentialsDetailsEndpoint.create_audit_entry"
    )
    def test_create_tempest_credentials(self, create_audit_entry):
        with Feature({"organizations:tempest-access": True}):
            self.login_as(self.user)
            response = self.get_success_response(
                self.project.organization.slug,
                self.project.slug,
                method="POST",
                **self.valid_credentials_data,
            )
            assert response.status_code == 201
            creds_obj = TempestCredentials.objects.get(project=self.project)
            assert creds_obj.client_id == self.valid_credentials_data["clientId"]
            assert creds_obj.client_secret == self.valid_credentials_data["clientSecret"]
            assert creds_obj.project == self.project
            assert creds_obj.created_by_id == self.user.id

            create_audit_entry.assert_called()

    def test_create_tempest_credentials_without_feature_flag(self):
        self.login_as(self.user)
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            method="POST",
            **self.valid_credentials_data,
        )
        assert response.status_code == 404

    def test_create_tempest_credentials_as_unauthenticated_user(self):
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            method="POST",
            **self.valid_credentials_data,
        )
        assert response.status_code == 401

    def test_non_admin_cant_create_tempest_credentials(self):
        non_admin_user = self.create_user()
        self.create_member(
            user=non_admin_user, organization=self.project.organization, role="member"
        )
        with Feature({"organizations:tempest-access": True}):
            self.login_as(non_admin_user)
            response = self.get_error_response(
                self.project.organization.slug,
                self.project.slug,
                method="POST",
                **self.valid_credentials_data,
            )
            assert response.status_code == 403

    def test_create_tempest_credentials_with_invalid_data(self):
        with Feature({"organizations:tempest-access": True}):
            self.login_as(self.user)
            response = self.get_error_response(
                self.project.organization.slug,
                self.project.slug,
                method="POST",
                **{"clientId": "test"},
            )
            assert response.status_code == 400

            response2 = self.get_error_response(
                self.project.organization.slug,
                self.project.slug,
                method="POST",
                **{"clientSecret": "test"},
            )
            assert response2.status_code == 400

    def test_cant_create_tempest_credentials_with_duplicate_client_id(self):
        with Feature({"organizations:tempest-access": True}):
            self.login_as(self.user)
            self.create_tempest_credentials(
                self.project, client_id=self.valid_credentials_data["clientId"]
            )
            response = self.get_error_response(
                self.project.organization.slug,
                self.project.slug,
                method="POST",
                **self.valid_credentials_data,
            )
            # database constraint violation
            assert response.status_code == 400
            assert response.data["detail"] == "A credential with this client ID already exists."

    def test_user_email_in_response(self):
        with Feature({"organizations:tempest-access": True}):
            self.login_as(self.user)
            self.create_tempest_credentials(self.project, created_by=self.user)
            response = self.get_success_response(self.project.organization.slug, self.project.slug)
            assert response.data[0]["createdByEmail"] == self.user.email
