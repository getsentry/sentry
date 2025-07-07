from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class OrganizationShortIDDocs(APIDocsTestCase):
    def setUp(self):
        group = self.create_group(project=self.project)

        self.url = reverse(
            "sentry-api-0-short-id-lookup",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "issue_id": group.qualified_short_id,
            },
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
