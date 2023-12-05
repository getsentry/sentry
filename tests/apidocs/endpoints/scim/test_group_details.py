from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.cases import SCIMTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SCIMTeamDetailsDocs(APIDocsTestCase, SCIMTestCase):
    def setUp(self):
        super().setUp()
        member_user = self.create_user()
        self.member = self.create_member(user=member_user, organization=self.organization)
        self.team = self.create_team(
            organization=self.organization, members=[self.user, member_user]
        )
        self.url = reverse(
            "sentry-api-0-organization-scim-team-details",
            kwargs={"organization_slug": self.organization.slug, "team_id": self.team.id},
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)
        self.validate_schema(request, response)

    def test_delete(self):
        response = self.client.delete(self.url)
        request = RequestFactory().delete(self.url)
        self.validate_schema(request, response)

    def test_patch_rename(self):
        patch_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [
                {
                    "op": "replace",
                    "value": {
                        "id": self.team.id,
                        "displayName": "newName",
                    },
                }
            ],
        }

        response = self.client.patch(self.url, patch_data)
        request = RequestFactory().patch(self.url, patch_data)
        self.validate_schema(request, response)

    def test_patch_replace(self):
        newmember = self.create_member(user=self.create_user(), organization=self.organization)
        patch_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [
                {
                    "op": "replace",
                    "path": "members",
                    "value": [
                        {
                            "value": newmember.id,
                            "display": "test2.user@okta.local",
                        },
                    ],
                }
            ],
        }

        response = self.client.patch(self.url, patch_data)
        request = RequestFactory().patch(self.url, patch_data)
        self.validate_schema(request, response)

    def test_patch_add_member(self):
        newmember = self.create_member(user=self.create_user(), organization=self.organization)
        patch_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [
                {
                    "op": "add",
                    "path": "members",
                    "value": [
                        {
                            "value": newmember.id,
                            "display": newmember.email,
                        }
                    ],
                },
            ],
        }

        response = self.client.patch(self.url, patch_data)
        request = RequestFactory().patch(self.url, patch_data)
        self.validate_schema(request, response)

    def test_patch_remove_member(self):
        patch_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [
                {
                    "op": "remove",
                    "path": f'members[value eq "{self.member.id}"]',
                }
            ],
        }

        response = self.client.patch(self.url, patch_data)
        request = RequestFactory().patch(self.url, patch_data)
        self.validate_schema(request, response)
