from urllib.parse import quote

from sentry.core.endpoints.scim.constants import (
    SCIM_API_ERROR,
    SCIM_API_LIST,
    SCIM_SCHEMA_GROUP,
    SCIM_SCHEMA_SCHEMA,
    SCIM_SCHEMA_USER,
)
from sentry.core.endpoints.scim.schemas import (
    SCIM_GROUP_ATTRIBUTES_SCHEMA,
    SCIM_SCHEMA_LIST,
    SCIM_USER_ATTRIBUTES_SCHEMA,
)
from sentry.testutils.cases import SCIMTestCase


class SCIMSchemaEndpointTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-schema-index"

    def test_schema_200s(self) -> None:
        self.get_success_response(self.organization.slug)

    def test_index_payload(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert response.data == {
            "schemas": [SCIM_API_LIST],
            "totalResults": 2,
            "startIndex": 1,
            "itemsPerPage": 2,
            "Resources": SCIM_SCHEMA_LIST,
        }

    def test_pagination_params_ignored(self) -> None:
        response = self.get_success_response(self.organization.slug, qs_params={"startIndex": "5"})
        assert response.data["startIndex"] == 1
        assert response.data["totalResults"] == 2

    def test_filter_param_rejected(self) -> None:
        response = self.get_error_response(
            self.organization.slug, qs_params={"filter": 'userName eq "test"'}, status_code=403
        )
        assert response.data == {
            "schemas": [SCIM_API_ERROR],
            "status": "403",
            "detail": "Filtering is not supported on this endpoint.",
        }

    def test_create_time_attributes_are_writable(self) -> None:
        # Entra excludes non-writable attributes from provisioning payloads
        # entirely, and cannot create users without sending userName/emails.
        user_attrs = {a["name"]: a for a in SCIM_USER_ATTRIBUTES_SCHEMA["attributes"]}
        assert user_attrs["userName"]["mutability"] == "readWrite"
        assert user_attrs["emails"]["mutability"] == "readWrite"

    def test_every_attribute_declares_mutability(self) -> None:
        # RFC 7643 §2.2 defaults mutability when omitted, but Entra's SCIM
        # validator rejects schemas whose attributes lack it entirely.
        for schema in SCIM_SCHEMA_LIST:
            for attribute in schema["attributes"]:
                assert "mutability" in attribute, (schema["name"], attribute["name"])
                for sub_attribute in attribute.get("subAttributes", []):
                    assert "mutability" in sub_attribute, (
                        schema["name"],
                        attribute["name"],
                        sub_attribute["name"],
                    )


class SCIMSchemaDetailsTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-schema-details"

    def test_user_schema(self) -> None:
        response = self.get_success_response(self.organization.slug, SCIM_SCHEMA_USER)
        assert response.data["schemas"] == [SCIM_SCHEMA_SCHEMA]
        assert response.data["id"] == SCIM_SCHEMA_USER
        assert response.data["name"] == "User"
        assert response.data["description"] == SCIM_USER_ATTRIBUTES_SCHEMA["description"]
        assert response.data["attributes"] == SCIM_USER_ATTRIBUTES_SCHEMA["attributes"]
        assert response.data["meta"]["resourceType"] == "Schema"
        assert response.data["meta"]["location"].endswith(
            f"/api/0/organizations/{self.organization.slug}/scim/v2/Schemas/{SCIM_SCHEMA_USER}"
        )

    def test_group_schema(self) -> None:
        response = self.get_success_response(self.organization.slug, SCIM_SCHEMA_GROUP)
        assert response.data["schemas"] == [SCIM_SCHEMA_SCHEMA]
        assert response.data["id"] == SCIM_SCHEMA_GROUP
        assert response.data["name"] == "Group"
        assert response.data["attributes"] == SCIM_GROUP_ATTRIBUTES_SCHEMA["attributes"]

    def test_percent_encoded_schema_uri(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/scim/v2/Schemas/" + quote(
            SCIM_SCHEMA_USER, safe=""
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["id"] == SCIM_SCHEMA_USER

    def test_unknown_schema_404s_with_scim_error_body(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
            status_code=404,
        )
        assert response.data == {
            "schemas": [SCIM_API_ERROR],
            "status": "404",
            "detail": "Schema not found.",
        }

    def test_lookup_is_case_sensitive(self) -> None:
        response = self.get_error_response(
            self.organization.slug, SCIM_SCHEMA_USER.lower(), status_code=404
        )
        assert response.data["schemas"] == [SCIM_API_ERROR]

    def test_slash_containing_uri_404s_with_scim_error_body(self) -> None:
        response = self.get_error_response(self.organization.slug, "not/a/schema", status_code=404)
        assert response.data["schemas"] == [SCIM_API_ERROR]
        assert response.data["status"] == "404"

    def test_filter_param_rejected(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            SCIM_SCHEMA_USER,
            qs_params={"filter": 'userName eq "test"'},
            status_code=403,
        )
        assert response.data["schemas"] == [SCIM_API_ERROR]
        assert response.data["status"] == "403"

    def test_post_not_allowed_with_scim_error_body(self) -> None:
        response = self.get_error_response(
            self.organization.slug, SCIM_SCHEMA_USER, method="post", status_code=405
        )
        assert response.data["schemas"] == [SCIM_API_ERROR]
        assert response.data["status"] == "405"
