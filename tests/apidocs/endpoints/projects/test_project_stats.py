from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class ProjectStatsDocs(APIDocsTestCase):
    def setUp(self):
        self.create_event("a", message="oh no")
        self.create_event("b", message="oh no")

        self.url = reverse(
            "sentry-api-0-project-stats",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
