import unittest

from django.urls import reverse

from sentry.models import OrganizationMember
from sentry.models.auditlogentry import AuditLogEntry, AuditLogEntryEvent
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
        }

        assert AuditLogEntry.objects.filter(
            target_object=member.id, event=AuditLogEntryEvent.MEMBER_INVITE
        ).exists()
        assert correct_post_data == response.data
        assert member.email == "test.user@okta.local"

    def test_post_users_already_exists(self):
        # test that response 409s if member already exists (by email)
        self.create_member(
            user=self.create_user(), organization=self.organization, email="test.user@okta.local"
        )
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.post(url, CREATE_USER_POST_DATA)
        assert response.status_code == 409, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User already exists in the database.",
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
