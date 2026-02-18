from django.db import connections

from sentry.hybridcloud.models import ApiKeyReplica
from sentry.models.apikey import ApiKey
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

DEFAULT_SCOPES = ["project:read", "event:read", "team:read", "org:read", "member:read"]


class OrganizationApiKeyDetailsBase(APITestCase):
    endpoint = "sentry-api-0-organization-api-key-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.api_key = ApiKey.objects.create(
            organization_id=self.organization.id, scope_list=DEFAULT_SCOPES
        )


@control_silo_test
class OrganizationApiKeyDetails(OrganizationApiKeyDetailsBase):
    def test_api_key_no_exist(self) -> None:
        self.get_error_response(self.organization.slug, 123456, status_code=404)

    def test_get_api_details(self) -> None:
        response = self.get_success_response(self.organization.slug, self.api_key.id)
        assert response.data.get("id") == str(self.api_key.id)


@control_silo_test
class OrganizationApiKeyDetailsPut(OrganizationApiKeyDetailsBase):
    method = "put"

    def test_update_api_key_details(self) -> None:
        data = {
            "label": "New Label",
            "allowed_origins": "sentry.io",
            "scope_list": ["project:read", "project:write", "org:read", "team:read"],
        }
        self.get_success_response(self.organization.slug, self.api_key.id, **data)

        api_key = ApiKey.objects.get(id=self.api_key.id, organization_id=self.organization.id)

        assert api_key.label == "New Label"
        assert api_key.allowed_origins == "sentry.io"
        assert api_key.get_scopes() == ["org:read", "project:read", "project:write", "team:read"]

    def test_update_api_key_rejects_invalid_scopes(self) -> None:
        data = {"scope_list": ["a", "b", "c", "d"]}
        response = self.get_error_response(
            self.organization.slug, self.api_key.id, status_code=400, **data
        )
        assert "scope_list" in response.data

        api_key = ApiKey.objects.get(id=self.api_key.id, organization_id=self.organization.id)
        assert api_key.get_scopes() == sorted(DEFAULT_SCOPES)

    def test_update_api_key_rejects_mixed_valid_and_invalid_scopes(self) -> None:
        data = {"scope_list": ["org:read", "superuser:admin", "project:read"]}
        response = self.get_error_response(
            self.organization.slug, self.api_key.id, status_code=400, **data
        )
        assert "scope_list" in response.data

    def test_update_api_key_details_legacy_data(self) -> None:
        # Some old api keys have this psql special format string
        with connections[ApiKey.objects.db].cursor() as cur:
            cur.execute(
                "update sentry_apikey set scope_list = %s where id = %s",
                ("{event:read,member:read,org:read,project:read,team:read}", self.api_key.id),
            )

        with assume_test_silo_mode(SiloMode.REGION):
            assert ApiKeyReplica.objects.get(apikey_id=self.api_key.id).get_scopes() == [
                "event:read",
                "member:read",
                "org:read",
                "project:read",
                "team:read",
            ]

        data = {"scope_list": ["project:read", "project:write", "org:read", "team:read"]}
        self.get_success_response(self.organization.slug, self.api_key.id, **data)

        api_key = ApiKey.objects.get(id=self.api_key.id, organization_id=self.organization.id)
        assert api_key.get_scopes() == ["org:read", "project:read", "project:write", "team:read"]


@control_silo_test
class OrganizationApiKeyDetailsDelete(OrganizationApiKeyDetailsBase):
    method = "delete"

    def test_can_delete_api_key(self) -> None:
        self.get_success_response(self.organization.slug, self.api_key.id)

        # check to make sure it's deleted
        self.get_error_response(
            self.organization.slug, self.api_key.id, method="get", status_code=404
        )
