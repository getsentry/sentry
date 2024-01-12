from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationShortIDDocs(APIDocsTestCase):
    def setUp(self):
        group = self.create_group(project=self.project)

        self.url = reverse(
            "sentry-api-0-short-id-lookup",
            kwargs={
                "organization_slug": self.organization.slug,
                "short_id": group.qualified_short_id,
            },
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
