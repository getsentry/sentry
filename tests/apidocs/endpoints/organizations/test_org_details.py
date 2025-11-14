from typing import int
from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class OrganizationDetailsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        organization = self.create_organization(owner=self.user, name="Rowdy Tiger")

        self.url = reverse(
            "sentry-api-0-organization-details",
            kwargs={"organization_id_or_slug": organization.slug},
        )

        self.login_as(user=self.user)

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self) -> None:
        data = {"name": "foo"}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)
