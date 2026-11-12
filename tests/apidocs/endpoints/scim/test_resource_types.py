from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.cases import SCIMTestCase


class SCIMResourceTypeIndexDocs(APIDocsTestCase, SCIMTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(
            "sentry-api-0-organization-scim-resource-type-index",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)
        self.validate_schema(request, response)


class SCIMResourceTypeDetailsDocs(APIDocsTestCase, SCIMTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(
            "sentry-api-0-organization-scim-resource-type-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "resource_type_name": "User",
            },
        )

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)
        self.validate_schema(request, response)
