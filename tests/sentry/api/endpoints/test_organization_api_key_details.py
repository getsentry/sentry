from sentry.models import ApiKey
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test

DEFAULT_SCOPES = ["project:read", "event:read", "team:read", "org:read", "member:read"]


class OrganizationApiKeyDetailsBase(APITestCase):
    endpoint = "sentry-api-0-organization-api-key-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.api_key = ApiKey.objects.create(
            organization_id=self.organization.id, scope_list=DEFAULT_SCOPES
        )


@region_silo_test
class OrganizationApiKeyDetails(OrganizationApiKeyDetailsBase):
    def test_api_key_no_exist(self):
        self.get_error_response(self.organization.slug, 123456, status_code=404)

    def test_get_api_details(self):
        response = self.get_success_response(self.organization.slug, self.api_key.id)
        assert response.data.get("id") == str(self.api_key.id)


@region_silo_test
class OrganizationApiKeyDetailsPut(OrganizationApiKeyDetailsBase):
    method = "put"

    def test_update_api_key_details(self):
        data = {"label": "New Label", "allowed_origins": "sentry.io"}
        self.get_success_response(self.organization.slug, self.api_key.id, **data)

        api_key = ApiKey.objects.get(id=self.api_key.id, organization_id=self.organization.id)

        assert api_key.label == "New Label"
        assert api_key.allowed_origins == "sentry.io"


@region_silo_test
class OrganizationApiKeyDetailsDelete(OrganizationApiKeyDetailsBase):
    method = "delete"

    def test_can_delete_api_key(self):
        self.get_success_response(self.organization.slug, self.api_key.id)

        # check to make sure it's deleted
        self.get_error_response(
            self.organization.slug, self.api_key.id, method="get", status_code=404
        )
