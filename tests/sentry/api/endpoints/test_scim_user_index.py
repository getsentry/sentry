import unittest

from django.urls import reverse

from sentry import audit_log
from sentry.models import OrganizationMember
from sentry.models.auditlogentry import AuditLogEntry
from sentry.scim.endpoints.utils import SCIMQueryParamSerializer
from sentry.testutils import SCIMAzureTestCase, SCIMTestCase

CREATE_USER_POST_DATA = {
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName": "test.user@okta.local",
    "name": {"givenName": "Test", "familyName": "User"},
    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
    "active": True,
}


class SCIMMemberIndexTests(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-member-index"

    def test_get_users_index_empty(self):
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=userName%20eq%20%22test.user%40okta.local%22"
        )
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 0,
            "startIndex": 1,
            "itemsPerPage": 0,
            "Resources": [],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

    def test_post_users_successful(self):
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.post(url, CREATE_USER_POST_DATA)
        assert response.status_code == 201, response.content
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )
        correct_post_data = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(member.id),
            "userName": "test.user@okta.local",
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "active": True,
            "name": {"familyName": "N/A", "givenName": "N/A"},
            "meta": {"resourceType": "User"},
            "sentryOrgRole": self.organization.default_role,
        }

        assert AuditLogEntry.objects.filter(
            target_object=member.id, event=audit_log.get_event_id("MEMBER_INVITE")
        ).exists()
        assert correct_post_data == response.data
        assert member.email == "test.user@okta.local"
        assert member.flags["idp:provisioned"]
        assert not member.flags["idp:role-restricted"]
        assert member.role == self.organization.default_role

    def test_post_users_already_exists(self):
        # test that response 409s if member already exists (by email)
        member = self.create_member(
            user=self.create_user(), organization=self.organization, email="test.user@okta.local"
        )
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.post(url, CREATE_USER_POST_DATA)
        assert response.status_code == 409, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User already exists in the database.",
        }
        assert not member.flags["idp:provisioned"]
        assert not member.flags["idp:role-restricted"]

    def test_post_users_with_role_valid(self):
        CREATE_USER_POST_DATA["sentryOrgRole"] = "manager"
        resp = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **CREATE_USER_POST_DATA
        )
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )

        correct_post_data = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(member.id),
            "userName": "test.user@okta.local",
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "active": True,
            "name": {"familyName": "N/A", "givenName": "N/A"},
            "meta": {"resourceType": "User"},
            "sentryOrgRole": "manager",
        }
        assert correct_post_data == resp.data
        assert member.role == "manager"
        assert member.flags["idp:provisioned"]
        assert member.flags["idp:role-restricted"]
        member.delete()

        # check role is case insensitive
        CREATE_USER_POST_DATA["sentryOrgRole"] = "mAnaGer"
        resp = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **CREATE_USER_POST_DATA
        )
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )

        correct_post_data["id"] = str(member.id)
        unittest.TestCase().assertDictEqual(correct_post_data, resp.data)
        assert member.role == "manager"
        assert member.flags["idp:provisioned"]
        assert member.flags["idp:role-restricted"]
        member.delete()

        # Empty org role -> default
        CREATE_USER_POST_DATA["sentryOrgRole"] = ""
        resp = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **CREATE_USER_POST_DATA
        )
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )
        correct_post_data["sentryOrgRole"] = self.organization.default_role
        correct_post_data["id"] = str(member.id)
        unittest.TestCase().assertDictEqual(correct_post_data, resp.data)
        assert member.role == self.organization.default_role
        assert member.flags["idp:provisioned"]
        assert not member.flags["idp:role-restricted"]
        member.delete()

        # no sentry org role -> default
        del CREATE_USER_POST_DATA["sentryOrgRole"]
        resp = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **CREATE_USER_POST_DATA
        )
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )
        correct_post_data["id"] = str(member.id)
        unittest.TestCase().assertDictEqual(correct_post_data, resp.data)
        assert member.role == self.organization.default_role
        member.delete()

    def test_post_users_with_role_invalid(self):
        # Non-existant role
        CREATE_USER_POST_DATA["sentryOrgRole"] = "nonexistant"
        resp = self.get_error_response(
            self.organization.slug, method="post", status_code=400, **CREATE_USER_POST_DATA
        )
        assert resp.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Invalid organization role.",
        }

        # Unallowed role
        CREATE_USER_POST_DATA["sentryOrgRole"] = "owner"
        resp = self.get_error_response(
            self.organization.slug, method="post", status_code=400, **CREATE_USER_POST_DATA
        )
        assert resp.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Invalid organization role.",
        }

    def test_users_get_populated(self):
        member = self.create_member(organization=self.organization, email="test.user@okta.local")
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=userName%20eq%20%22test.user%40okta.local%22"
        )
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": str(member.id),
                    "userName": "test.user@okta.local",
                    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "active": True,
                    "meta": {"resourceType": "User"},
                    "sentryOrgRole": self.organization.default_role,
                }
            ],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

    def test_users_get_filter_case_insensitive(self):
        member = self.create_member(organization=self.organization, email="test.user@okta.local")
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=userName%20eq%20%22TEST.USER%40okta.local%22"
        )
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": str(member.id),
                    "userName": "test.user@okta.local",
                    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "active": True,
                    "meta": {"resourceType": "User"},
                    "sentryOrgRole": self.organization.default_role,
                }
            ],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

    def test_pagination(self):
        for _ in range(0, 150):
            self.create_member(
                user=self.create_user(),
                organization=self.organization,
                role="member",
                teams=[],
            )

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 100
        assert response.data["startIndex"] == 1
        assert len(response.data["Resources"]) == 100

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=40&count=100")
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 100
        assert response.data["startIndex"] == 40
        assert len(response.data["Resources"]) == 100

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=101&count=100")
        assert len(response.data["Resources"]) == 51
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 51
        assert response.data["startIndex"] == 101


class SCIMMemberIndexAzureTests(SCIMAzureTestCase):
    def test_user_index_get_no_active(self):
        member = self.create_member(organization=self.organization, email="test.user@okta.local")
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=userName%20eq%20%22test.user%40okta.local%22"
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": str(member.id),
                    "userName": "test.user@okta.local",
                    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "meta": {"resourceType": "User"},
                    "sentryOrgRole": self.organization.default_role,
                }
            ],
        }


class SCIMQueryParameterSerializerTest(unittest.TestCase):
    def test_defaults(self):
        serializer = SCIMQueryParamSerializer(data={})
        assert serializer.is_valid()
        assert serializer.validated_data["start_index"] == 1
        assert serializer.validated_data["count"] == 100
        assert serializer.validated_data["excluded_attributes"] == []
        assert serializer.validated_data["filter"] is None

    def test_start_index(self):
        serializer = SCIMQueryParamSerializer(data={"startIndex": 0})
        assert not serializer.is_valid()

        serializer = SCIMQueryParamSerializer(data={"startIndex": 1})
        assert serializer.is_valid()

    def test_count(self):
        serializer = SCIMQueryParamSerializer(data={"count": -1})
        assert not serializer.is_valid()

        serializer = SCIMQueryParamSerializer(data={"count": 0})
        assert serializer.is_valid()

    def test_filter(self):
        serializer = SCIMQueryParamSerializer(data={"filter": "aoiwefjoi3j9f"})
        assert not serializer.is_valid()

    def test_excluded_attributes(self):
        serializer = SCIMQueryParamSerializer(data={"excludedAttributes": ["members"]})
        assert serializer.is_valid()
