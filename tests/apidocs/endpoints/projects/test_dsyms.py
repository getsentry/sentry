from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class ProjectDsymsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.create_dif_file(project=self.project)

        self.login_as(user=self.user)

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
