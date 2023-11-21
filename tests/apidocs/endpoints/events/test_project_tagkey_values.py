from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectTagKeyValuesDocs(APIDocsTestCase):
    def setUp(self):
        key = "foo"
        self.create_event("a", tags={key: "bar"})

        self.login_as(user=self.user)

        self.url = reverse(
            "sentry-api-0-project-tagkey-values",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "key": key,
            },
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
