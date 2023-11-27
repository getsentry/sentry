import unittest
from datetime import timedelta
from unittest.mock import call, patch

from django.urls import reverse
from django.utils import timezone

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.scim.endpoints.utils import SCIMQueryParamSerializer
from sentry.silo import SiloMode
from sentry.testutils.cases import SCIMAzureTestCase, SCIMTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, region_silo_test


def post_data():
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "userName": "test.user@okta.local",
        "name": {"givenName": "Test", "familyName": "User"},
        "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
        "active": True,
    }


def merge_dictionaries(dict1, dict2):
    return {**dict1, **dict2}


@region_silo_test
class SCIMMemberIndexTests(SCIMTestCase, HybridCloudTestMixin):
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

    @patch("sentry.scim.endpoints.members.metrics")
    def test_post_users_successful(self, mock_metrics):
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        with outbox_runner():
            response = self.client.post(url, post_data())
        assert response.status_code == 201, response.content
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )
        self.assert_org_member_mapping(org_member=member)
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

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=member.id, event=audit_log.get_event_id("MEMBER_INVITE")
            ).exists()
        assert correct_post_data == response.data
        assert member.email == "test.user@okta.local"
        assert member.flags["idp:provisioned"]
        assert not member.flags["idp:role-restricted"]
        assert member.role == self.organization.default_role
        mock_metrics.incr.assert_called_with(
            "sentry.scim.member.provision",
            tags={"organization": self.organization},
        )

    @patch("sentry.scim.endpoints.members.metrics")
    def test_update_role_metric_called_when_role_specified(self, mock_metrics):
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        with outbox_runner():
            response = self.client.post(
                url, merge_dictionaries(post_data(), {"sentryOrgRole": "member"})
            )
        assert response.status_code == 201, response.content
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )
        self.assert_org_member_mapping(org_member=member)
        correct_post_data = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(member.id),
            "userName": "test.user@okta.local",
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "active": True,
            "name": {"familyName": "N/A", "givenName": "N/A"},
            "meta": {"resourceType": "User"},
            "sentryOrgRole": "member",
        }

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=member.id, event=audit_log.get_event_id("MEMBER_INVITE")
            ).exists()
        assert correct_post_data == response.data
        assert member.email == "test.user@okta.local"
        assert member.flags["idp:provisioned"]
        assert member.flags["idp:role-restricted"]
        assert member.role == self.organization.default_role
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "sentry.scim.member.provision",
                    tags={"organization": self.organization},
                ),
                call(
                    "sentry.scim.member.update_role",
                    tags={"organization": self.organization},
                ),
            ],
        )

    def test_post_users_successful_existing_invite(self):
        member = self.create_member(
            organization=self.organization,
            email="test.user@okta.local",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
            token_expires_at=timezone.now() - timedelta(weeks=52),
        )
        assert member.token_expired

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        with outbox_runner():
            response = self.client.post(url, post_data())

        assert response.status_code == 201, response.content
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )
        # Token was refreshed
        assert member.token_expired is False

        self.assert_org_member_mapping(org_member=member)
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

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=member.id, event=audit_log.get_event_id("MEMBER_INVITE")
            ).exists()
        assert correct_post_data == response.data
        assert member.email == "test.user@okta.local"
        assert not member.flags["idp:provisioned"]
        assert not member.flags["idp:role-restricted"]
        assert member.role == self.organization.default_role

    def test_post_users_already_exists(self):
        # test that response 409s if member already exists (by email)
        member = self.create_member(
            user=self.create_user(email="test.user@okta.local"), organization=self.organization
        )
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.post(url, post_data())
        assert response.status_code == 409, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User already exists in the database.",
        }
        assert not member.flags["idp:provisioned"]
        assert not member.flags["idp:role-restricted"]

    def test_post_users_with_role_valid(self):
        data = post_data()
        data["sentryOrgRole"] = "manager"
        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, method="post", status_code=201, **data
            )
        member = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        )
        self.assert_org_member_mapping(org_member=member)

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
        data = post_data()
        data["sentryOrgRole"] = "mAnaGer"
        resp = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **data
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
        data["sentryOrgRole"] = ""
        resp = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **data
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
        del data["sentryOrgRole"]
        resp = self.get_success_response(
            self.organization.slug, method="post", status_code=201, **data
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
        data = post_data()
        data["sentryOrgRole"] = "nonexistant"
        resp = self.get_error_response(
            self.organization.slug, method="post", status_code=400, **data
        )
        assert resp.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Invalid organization role.",
        }

        # Unallowed role
        data["sentryOrgRole"] = "owner"
        resp = self.get_error_response(
            self.organization.slug, method="post", status_code=400, **data
        )
        assert resp.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Invalid organization role.",
        }

    def test_get_members_with_filter__invited(self):
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

    def test_get_members_no_filter__invited(self):
        member = self.create_member(organization=self.organization, email="test.user@okta.local")
        admin = OrganizationMember.objects.get(organization=self.organization, user_id=self.user.id)
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 2,
            "startIndex": 1,
            "itemsPerPage": 2,
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
                },
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": str(admin.id),
                    "userName": self.user.username,
                    "emails": [{"primary": True, "value": self.user.email, "type": "work"}],
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "active": True,
                    "meta": {"resourceType": "User"},
                    "sentryOrgRole": "owner",
                },
            ],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

    def test_get_members_no_filter__approved(self):
        user = self.create_user(email="test.user@okta.local")
        member = self.create_member(organization=self.organization, user=user)
        admin = OrganizationMember.objects.get(organization=self.organization, user_id=self.user.id)
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 2,
            "startIndex": 1,
            "itemsPerPage": 2,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": str(admin.id),
                    "userName": self.user.username,
                    "emails": [{"primary": True, "value": self.user.email, "type": "work"}],
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "active": True,
                    "meta": {"resourceType": "User"},
                    "sentryOrgRole": "owner",
                },
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": str(member.id),
                    "userName": "test.user@okta.local",
                    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "active": True,
                    "meta": {"resourceType": "User"},
                    "sentryOrgRole": self.organization.default_role,
                },
            ],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

    def test_get_members_with_filter__approved(self):
        user = self.create_user(email="test.user@okta.local")
        member = self.create_member(organization=self.organization, user=user)
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
        for _ in range(0, 15):
            self.create_member(
                user=self.create_user(),
                organization=self.organization,
                role="member",
                teams=[],
            )

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=10")
        assert response.data["totalResults"] == 16
        assert response.data["itemsPerPage"] == 10
        assert response.data["startIndex"] == 1
        assert len(response.data["Resources"]) == 10

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=10&count=10")
        assert response.data["totalResults"] == 16
        assert response.data["itemsPerPage"] == 7
        assert response.data["startIndex"] == 10
        assert len(response.data["Resources"]) == 7


@region_silo_test
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


@all_silo_test
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
