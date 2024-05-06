from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.cases import SCIMTestCase


class SCIMMemberDetailsDocs(APIDocsTestCase, SCIMTestCase):
    def setUp(self):
        super().setUp()
        self.member = self.create_member(user=self.create_user(), organization=self.organization)

        self.url = reverse(
            "sentry-api-0-organization-scim-member-details",
            kwargs={"organization_slug": self.organization.slug, "member_id": self.member.id},
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)
        self.validate_schema(request, response)

    def test_delete(self):
        response = self.client.delete(self.url)
        request = RequestFactory().delete(self.url)
        self.validate_schema(request, response)

    def test_get_invalid(self):
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            kwargs={"organization_slug": self.organization.slug, "member_id": 321},
        )
        response = self.client.get(url)
        assert response.status_code == 404
        assert response.data["schemas"] == ["urn:ietf:params:scim:api:messages:2.0:Error"]
