from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class ProjectReleasesDocsTest(APIDocsTestCase):
    def setUp(self) -> None:
        self.create_release(project=self.project, version="1.0.0")
        self.url = reverse(
            "sentry-api-0-project-releases",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.login_as(user=self.user)

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
