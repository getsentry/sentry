from sentry.core.endpoints.scim.constants import (
    SCIM_API_ERROR,
    SCIM_API_LIST,
    SCIM_SCHEMA_GROUP,
    SCIM_SCHEMA_RESOURCE_TYPE,
    SCIM_SCHEMA_USER,
)
from sentry.testutils.cases import SCIMTestCase


class SCIMResourceTypeIndexTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-resource-type-index"

    def test_200s_with_user_and_group(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert response.data["schemas"] == [SCIM_API_LIST]
        assert response.data["totalResults"] == 2
        assert response.data["startIndex"] == 1
        assert response.data["itemsPerPage"] == 2

        user_entry, group_entry = response.data["Resources"]
        assert user_entry["schemas"] == [SCIM_SCHEMA_RESOURCE_TYPE]
        assert user_entry["id"] == "User"
        assert user_entry["name"] == "User"
        assert user_entry["endpoint"] == "/Users"
        assert user_entry["schema"] == SCIM_SCHEMA_USER
        assert user_entry["meta"]["resourceType"] == "ResourceType"
        assert user_entry["meta"]["location"].endswith(
            f"/api/0/organizations/{self.organization.slug}/scim/v2/ResourceTypes/User"
        )
        assert "schemaExtensions" not in user_entry

        assert group_entry["schemas"] == [SCIM_SCHEMA_RESOURCE_TYPE]
        assert group_entry["id"] == "Group"
        assert group_entry["name"] == "Group"
        assert group_entry["endpoint"] == "/Groups"
        assert group_entry["schema"] == SCIM_SCHEMA_GROUP
        assert group_entry["meta"]["resourceType"] == "ResourceType"
        assert "schemaExtensions" not in group_entry

    def test_pagination_params_ignored(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"startIndex": "1", "count": "1"}
        )
        assert response.data["totalResults"] == 2
        assert response.data["itemsPerPage"] == 2
        assert response.data["startIndex"] == 1

    def test_invalid_pagination_params_ignored(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"startIndex": "abc"}
        )
        assert response.data["totalResults"] == 2

    def test_filter_param_rejected(self) -> None:
        response = self.get_error_response(
            self.organization.slug, qs_params={"filter": 'displayName eq "test"'}, status_code=403
        )
        assert response.data == {
            "schemas": [SCIM_API_ERROR],
            "status": "403",
            "detail": "Filtering is not supported on this endpoint.",
        }

    def test_post_not_allowed_with_scim_error_body(self) -> None:
        response = self.get_error_response(self.organization.slug, method="post", status_code=405)
        assert response.data["schemas"] == [SCIM_API_ERROR]
        assert response.data["status"] == "405"


class SCIMResourceTypeDetailsTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-resource-type-details"

    def test_user_resource_type(self) -> None:
        response = self.get_success_response(self.organization.slug, "User")
        assert response.data["schemas"] == [SCIM_SCHEMA_RESOURCE_TYPE]
        assert response.data["id"] == "User"
        assert response.data["endpoint"] == "/Users"
        assert response.data["schema"] == SCIM_SCHEMA_USER
        assert "Resources" not in response.data
        assert "totalResults" not in response.data

    def test_group_resource_type(self) -> None:
        response = self.get_success_response(self.organization.slug, "Group")
        assert response.data["id"] == "Group"
        assert response.data["endpoint"] == "/Groups"
        assert response.data["schema"] == SCIM_SCHEMA_GROUP

    def test_unknown_resource_type_404s_with_scim_error_body(self) -> None:
        response = self.get_error_response(self.organization.slug, "Unknown", status_code=404)
        assert response.data == {
            "schemas": [SCIM_API_ERROR],
            "status": "404",
            "detail": "Resource type not found.",
        }

    def test_lookup_is_case_sensitive(self) -> None:
        response = self.get_error_response(self.organization.slug, "user", status_code=404)
        assert response.data["schemas"] == [SCIM_API_ERROR]

    def test_slash_containing_name_404s_with_scim_error_body(self) -> None:
        response = self.get_error_response(self.organization.slug, "User/extra", status_code=404)
        assert response.data["schemas"] == [SCIM_API_ERROR]
        assert response.data["status"] == "404"

    def test_filter_param_rejected(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            "User",
            qs_params={"filter": 'displayName eq "x"'},
            status_code=403,
        )
        assert response.data["schemas"] == [SCIM_API_ERROR]
        assert response.data["status"] == "403"
