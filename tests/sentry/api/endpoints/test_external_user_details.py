from sentry.models import ExternalActor
from sentry.testutils import APITestCase


class ExternalUserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-external-user-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.external_user = self.create_external_user(
            self.user, self.organization, external_name="@NisanthanNanthakumar"
        )

    def test_basic_delete(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            self.get_success_response(
                self.organization.slug, self.external_user.id, method="delete"
            )
        assert not ExternalActor.objects.filter(id=str(self.external_user.id)).exists()

    def test_basic_update(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            data = {"externalName": "@new_username"}
            response = self.get_success_response(
                self.organization.slug, self.external_user.id, **data
            )
        assert response.data["id"] == str(self.external_user.id)
        assert response.data["externalName"] == "@new_username"

    def test_invalid_provider_update(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            data = {"provider": "unknown"}
            response = self.get_error_response(
                self.organization.slug, self.external_user.id, status_code=400, **data
            )
        assert response.data == {"provider": ['"unknown" is not a valid choice.']}
