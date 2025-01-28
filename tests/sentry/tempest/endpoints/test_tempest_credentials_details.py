from unittest.mock import patch

from sentry.tempest.models import TempestCredentials
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import Feature


class TestTempestCredentialsDetails(APITestCase):
    endpoint = "sentry-api-0-project-tempest-credentials-details"

    def setUp(self):
        super().setUp()
        self.tempest_credentials = self.create_tempest_credentials(self.project)

    def test_cant_access_endpoint_if_feature_flag_is_disabled(self):
        self.login_as(self.user)
        response = self.get_response(
            self.project.organization.slug,
            self.project.slug,
            self.tempest_credentials.id,
            method="DELETE",
        )
        assert response.status_code == 404

    def test_cant_access_endpoint_if_user_is_not_authenticated(self):
        response = self.get_response(
            self.project.organization.slug,
            self.project.slug,
            self.tempest_credentials.id,
            method="DELETE",
        )
        assert response.status_code == 401

    @patch(
        "sentry.tempest.endpoints.tempest_credentials_details.TempestCredentialsDetailsEndpoint.create_audit_entry"
    )
    def test_delete_tempest_credentials_as_org_admin(self, create_audit_entry):
        with Feature({"organizations:tempest-access": True}):
            self.login_as(self.user)
            response = self.get_response(
                self.project.organization.slug,
                self.project.slug,
                self.tempest_credentials.id,
                method="DELETE",
            )

        assert response.status_code == 204
        assert not TempestCredentials.objects.filter(id=self.tempest_credentials.id).exists()
        create_audit_entry.assert_called()

    def test_non_admin_cant_delete_credentials(self):
        non_admin_user = self.create_user()
        self.create_member(
            user=non_admin_user, organization=self.project.organization, role="member"
        )
        with Feature({"organizations:tempest-access": True}):
            self.login_as(non_admin_user)
            response = self.get_response(
                self.project.organization.slug,
                self.project.slug,
                self.tempest_credentials.id,
                method="DELETE",
            )

        assert response.status_code == 403
        assert TempestCredentials.objects.filter(id=self.tempest_credentials.id).exists()
