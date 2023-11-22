from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.cases import SCIMTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SCIMTeamIndexDocs(APIDocsTestCase, SCIMTestCase):
    def setUp(self):
        super().setUp()
        self.member = self.create_member(user=self.create_user(), organization=self.organization)
        self.team = self.create_team(organization=self.organization, members=[self.user])
        self.url = reverse(
            "sentry-api-0-organization-scim-team-index",
            kwargs={"organization_slug": self.organization.slug},
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)
        self.validate_schema(request, response)

    def test_post(self):
        post_data = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "displayName": "Test SCIMv2",
            "members": [],
        }

        response = self.client.post(self.url, post_data)
        request = RequestFactory().post(self.url, post_data)
        self.validate_schema(request, response)
